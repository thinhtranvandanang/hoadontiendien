import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BillDisplayPanel } from './components/BillDisplayPanel.tsx';
import { BillDocumentViewer } from './components/BillDocumentViewer.tsx';
import { BillHistoryPanel } from './components/BillHistoryPanel.tsx';
import type {
  BillVerificationSummary,
  ElectricityBillData,
  ParsedBillRecord,
} from './types/bill.ts';
import { verifyElectricityBill } from './utils/billVerification.ts';

const SAMPLE_IMAGE_URL = '/assets/aistudio/image_51f8d943.png';
const SAMPLE_FILE_NAME = 'Hóa đơn EVNHCMC (mẫu đính kèm).png';
const HISTORY_STORAGE_KEY = 'evn_bill_reader_history_v1';

function readFileAsDataUrl(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const originalDataUrl = String(reader.result || '');
      // Compress large images (> 1.2 MB or wide camera shots) so Edge/Cloudflare requests stay fast
      if (file.size <= 1_200_000) {
        resolve({ dataUrl: originalDataUrl, mimeType: file.type || 'image/png' });
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxSide = 1800;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: originalDataUrl, mimeType: file.type || 'image/png' });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.88);
        resolve({ dataUrl: compressed, mimeType: 'image/jpeg' });
      };
      img.onerror = () => {
        resolve({ dataUrl: originalDataUrl, mimeType: file.type || 'image/png' });
      };
      img.src = originalDataUrl;
    };
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh từ thiết bị.'));
    reader.readAsDataURL(file);
  });
}

function loadSavedRecords(): ParsedBillRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ParsedBillRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistRecords(records: ParsedBillRecord[]) {
  try {
    const compact = records.slice(0, 12).map((rec) => ({
      ...rec,
      // Avoid blowing localStorage quota with very large base64 images
      imageUrl:
        rec.imageUrl.startsWith('data:') && rec.imageUrl.length > 350_000
          ? ''
          : rec.imageUrl,
    }));
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(compact));
  } catch {
    // Ignore storage quota errors silently
  }
}

export default function App() {
  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const [records, setRecords] = useState<ParsedBillRecord[]>(() => loadSavedRecords());
  const [activeRecordId, setActiveRecordId] = useState<string | null>(() => {
    const saved = loadSavedRecords();
    return saved.length > 0 ? saved[0].id : null;
  });

  const [imageUrl, setImageUrl] = useState<string>(() => {
    const saved = loadSavedRecords();
    return saved.length > 0 && saved[0].imageUrl ? saved[0].imageUrl : SAMPLE_IMAGE_URL;
  });
  const [fileName, setFileName] = useState<string>(() => {
    const saved = loadSavedRecords();
    return saved.length > 0 ? saved[0].fileName : SAMPLE_FILE_NAME;
  });
  const [currentData, setCurrentData] = useState<ElectricityBillData | null>(() => {
    const saved = loadSavedRecords();
    return saved.length > 0 ? saved[0].data : null;
  });
  const [currentVerification, setCurrentVerification] =
    useState<BillVerificationSummary | null>(() => {
      const saved = loadSavedRecords();
      return saved.length > 0 ? saved[0].verification : null;
    });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'tiers' | 'export'>('overview');

  const saveNewRecord = useCallback(
    (
      nextData: ElectricityBillData,
      nextVerification: BillVerificationSummary,
      nextImageUrl: string,
      nextFileName: string,
    ) => {
      const newRecord: ParsedBillRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: nextFileName,
        imageUrl: nextImageUrl,
        parsedAt: new Date().toISOString(),
        data: nextData,
        verification: nextVerification,
      };
      setRecords((prev) => {
        const nextList = [newRecord, ...prev];
        persistRecords(nextList);
        return nextList;
      });
      setActiveRecordId(newRecord.id);
    },
    [],
  );

  const parseBillResponse = async (res: Response) => {
    const rawText = await res.text();
    if (!rawText.trim()) {
      if (res.status === 404 || res.status === 405) {
        throw new Error(
          `Endpoint /api/parse-bill chưa được kích hoạt trên máy chủ (HTTP ${res.status}). Nếu triển khai lên Cloudflare Workers, hãy đảm bảo chạy lệnh build trước khi deploy với wrangler.jsonc và cấu hình secret GEMINI_API_KEY.`,
        );
      }
      throw new Error(
        `Máy chủ không trả về dữ liệu (HTTP ${res.status}). Vui lòng bấm "Thử đọc lại".`,
      );
    }
    if (rawText.trim().startsWith('<!doctype') || rawText.trim().startsWith('<html')) {
      throw new Error(
        'Máy chủ trả về trang HTML thay vì dữ liệu JSON cho /api/parse-bill. Hãy kiểm tra cấu hình Worker (wrangler.jsonc) để định tuyến /api/* về worker.ts.',
      );
    }
    let payload: {
      data?: ElectricityBillData;
      verification?: BillVerificationSummary;
      error?: string;
    };
    try {
      payload = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Phản hồi từ máy chủ không đúng định dạng (HTTP ${res.status}). Vui lòng bấm "Thử đọc lại".`,
      );
    }
    if (!res.ok || !payload.data || !payload.verification) {
      throw new Error(payload.error || 'Không thể phân tích hóa đơn.');
    }
    return { data: payload.data, verification: payload.verification };
  };

  const analyzeSampleBill = useCallback(async () => {
    setImageUrl(SAMPLE_IMAGE_URL);
    setFileName(SAMPLE_FILE_NAME);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/parse-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useSample: true }),
      });
      const { data, verification } = await parseBillResponse(res);

      setCurrentData(data);
      setCurrentVerification(verification);
      saveNewRecord(data, verification, SAMPLE_IMAGE_URL, SAMPLE_FILE_NAME);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Đã xảy ra lỗi kết nối khi đọc hóa đơn.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [saveNewRecord]);

  const analyzeImageDataUrl = useCallback(
    async (dataUrl: string, mimeType: string, nextFileName: string) => {
      setImageUrl(dataUrl);
      setFileName(nextFileName);
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/parse-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl, mimeType }),
        });
        const { data, verification } = await parseBillResponse(res);

        setCurrentData(data);
        setCurrentVerification(verification);
        saveNewRecord(data, verification, dataUrl, nextFileName);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Đã xảy ra lỗi khi phân tích ảnh hóa đơn.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [saveNewRecord],
  );

  const handleSelectFile = useCallback(
    async (file: File) => {
      try {
        const { dataUrl, mimeType } = await readFileAsDataUrl(file);
        await analyzeImageDataUrl(dataUrl, mimeType, file.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể đọc tệp ảnh.');
      }
    },
    [analyzeImageDataUrl],
  );

  const handleReanalyzeCurrent = useCallback(async () => {
    if (!imageUrl) return;
    if (imageUrl === SAMPLE_IMAGE_URL) {
      await analyzeSampleBill();
      return;
    }
    if (imageUrl.startsWith('data:')) {
      const mimeMatch = imageUrl.match(/^data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      await analyzeImageDataUrl(imageUrl, mimeType, fileName);
    }
  }, [analyzeImageDataUrl, analyzeSampleBill, fileName, imageUrl]);

  // Auto-read the attached sample bill on first launch if no cached bill exists
  useEffect(() => {
    if (!currentData && records.length === 0) {
      void analyzeSampleBill();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Support Ctrl+V paste of bill screenshots anywhere on the page
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            void handleSelectFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleSelectFile]);

  const handleUpdateBill = (updated: ElectricityBillData) => {
    const nextVerification = verifyElectricityBill(updated);
    setCurrentData(updated);
    setCurrentVerification(nextVerification);

    if (activeRecordId) {
      setRecords((prev) => {
        const nextList = prev.map((rec) =>
          rec.id === activeRecordId
            ? { ...rec, data: updated, verification: nextVerification }
            : rec,
        );
        persistRecords(nextList);
        return nextList;
      });
    }
  };

  const handleSelectRecord = (rec: ParsedBillRecord) => {
    setActiveRecordId(rec.id);
    setCurrentData(rec.data);
    setCurrentVerification(rec.verification);
    setImageUrl(rec.imageUrl || SAMPLE_IMAGE_URL);
    setFileName(rec.fileName);
    setError(null);
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeleteRecord = (id: string) => {
    setRecords((prev) => {
      const nextList = prev.filter((r) => r.id !== id);
      persistRecords(nextList);
      if (activeRecordId === id) {
        if (nextList.length > 0) {
          setActiveRecordId(nextList[0].id);
          setCurrentData(nextList[0].data);
          setCurrentVerification(nextList[0].verification);
          setImageUrl(nextList[0].imageUrl || SAMPLE_IMAGE_URL);
          setFileName(nextList[0].fileName);
        } else {
          setActiveRecordId(null);
          setCurrentData(null);
          setCurrentVerification(null);
        }
      }
      return nextList;
    });
  };

  const navigateToSection = (section: 'overview' | 'tiers' | 'export') => {
    setActiveSection(section);
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToHistory = () => {
    document
      .getElementById('history-section')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones, 1 row, gap-8, whitespace-nowrap */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 no-print">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand wordmark */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            Đọc Hóa Đơn Điện
          </a>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => navigateToSection('overview')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Trình đọc hóa đơn
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('tiers')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Bảng bậc thang
            </button>
            <button
              type="button"
              onClick={scrollToHistory}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Lịch sử đọc
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('export')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Xuất dữ liệu
            </button>
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center shrink-0">
            <input
              ref={headerFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleSelectFile(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={isLoading}
              onClick={() => headerFileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              Tải ảnh hóa đơn
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="top" className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Contextual Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 no-print">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Trích xuất & Hiển thị Hóa đơn Tiền điện
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500">
              <span>Nhận diện tự động hóa đơn EVN</span>
              <span aria-hidden="true">·</span>
              <span>Đối soát chỉ số công tơ & bậc thang giá điện</span>
              <span aria-hidden="true">·</span>
              <span>Hỗ trợ dán ảnh Ctrl+V</span>
            </div>
          </div>
        </div>

        {/* Workspace Split */}
        <div
          ref={workspaceRef}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          <div className="lg:col-span-5 lg:sticky lg:top-22 no-print">
            <BillDocumentViewer
              imageUrl={imageUrl}
              fileName={fileName}
              isLoading={isLoading}
              onSelectFile={handleSelectFile}
              onAnalyzeSample={() => void analyzeSampleBill()}
              onReanalyzeCurrent={() => void handleReanalyzeCurrent()}
            />
          </div>

          <div className="lg:col-span-7">
            <BillDisplayPanel
              bill={currentData}
              verification={currentVerification}
              isLoading={isLoading}
              error={error}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              onUpdateBill={handleUpdateBill}
              onRetry={() => void handleReanalyzeCurrent()}
            />
          </div>
        </div>

        {/* Saved History Table */}
        <BillHistoryPanel
          records={records}
          activeRecordId={activeRecordId}
          onSelectRecord={handleSelectRecord}
          onDeleteRecord={handleDeleteRecord}
        />
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8 no-print">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>Đọc Hóa Đơn Tiền Điện — Công cụ đối soát sản lượng và tiền điện</span>
          <span>Dữ liệu lịch sử được lưu cục bộ trên trình duyệt của bạn</span>
        </div>
      </footer>
    </div>
  );
}
