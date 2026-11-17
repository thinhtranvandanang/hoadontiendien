import React, { useRef, useState } from 'react';
import {
  FileImage,
  Maximize2,
  RotateCw,
  ScanLine,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface BillDocumentViewerProps {
  imageUrl: string;
  fileName: string;
  isLoading: boolean;
  onSelectFile: (file: File) => void;
  onAnalyzeSample: () => void;
  onReanalyzeCurrent: () => void;
}

export const BillDocumentViewer: React.FC<BillDocumentViewerProps> = ({
  imageUrl,
  fileName,
  isLoading,
  onSelectFile,
  onAnalyzeSample,
  onReanalyzeCurrent,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [imageFailed, setImageFailed] = useState<boolean>(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    setImageFailed(false);
    setZoom(1);
    setRotation(0);
    onSelectFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <section
      aria-label="Tài liệu hóa đơn gốc"
      className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/70">
        <div className="min-w-0 flex items-center gap-2">
          <FileImage className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-800 truncate" title={fileName}>
            {fileName || 'Hóa đơn tiền điện'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            title="Thu nhỏ"
            aria-label="Thu nhỏ ảnh"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="px-1.5 text-xs font-mono tabular-nums text-slate-600 min-w-[3.2rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            title="Phóng to"
            aria-label="Phóng to ảnh"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            title="Xoay 90 độ"
            aria-label="Xoay ảnh 90 độ"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setRotation(0);
            }}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            title="Đặt lại khung nhìn"
            aria-label="Đặt lại khung nhìn"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image Dropzone / Canvas */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative min-h-[420px] lg:min-h-[540px] max-h-[680px] overflow-auto bg-slate-100 flex items-center justify-center p-4 transition-colors ${
          isDragging ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : ''
        }`}
      >
        {imageUrl && !imageFailed ? (
          <div className="flex items-center justify-center min-w-full min-h-full">
            <img
              src={imageUrl}
              alt="Ảnh hóa đơn tiền điện gốc"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
              className="max-w-full h-auto rounded shadow-sm transition-transform duration-150 ease-out select-none"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center max-w-sm py-12 px-6">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-4">
              <Upload className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-800 mb-1">
              Kéo thả ảnh hóa đơn tiền điện vào đây
            </p>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Hỗ trợ định dạng PNG, JPG, WEBP hoặc dán trực tiếp từ clipboard (Ctrl+V).
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Chọn tệp từ máy
            </button>
          </div>
        )}

        {isDragging && (
          <div className="absolute inset-0 bg-blue-900/15 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="bg-white border border-blue-200 rounded-xl px-5 py-3 shadow-sm text-sm font-medium text-blue-900">
              Thả ảnh để đọc hóa đơn
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic"
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Chọn ảnh khác</span>
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onAnalyzeSample}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <span>Nạp mẫu EVNHCMC</span>
          </button>
        </div>

        <button
          type="button"
          disabled={isLoading || !imageUrl}
          onClick={onReanalyzeCurrent}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <ScanLine className="w-3.5 h-3.5" />
          <span>{isLoading ? 'Đang trích xuất...' : 'Đọc lại hóa đơn'}</span>
        </button>
      </div>
    </section>
  );
};
