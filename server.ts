import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { ElectricityBillData } from './src/types/bill.ts';
import { verifyElectricityBill } from './src/utils/billVerification.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong môi trường máy chủ.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const billResponseSchema = {
  type: Type.OBJECT,
  properties: {
    corporationName: { type: Type.STRING, description: 'Tên tổng công ty điện lực (VD: EVNHCMC - TỔNG CÔNG TY ĐIỆN LỰC THÀNH PHỐ HỒ CHÍ MINH)' },
    powerCompanyName: { type: Type.STRING, description: 'Tên công ty điện lực phát hành (VD: CÔNG TY ĐIỆN LỰC BÌNH PHÚ)' },
    powerCompanyAddress: { type: Type.STRING, description: 'Địa chỉ đơn vị điện lực' },
    powerCompanyPhone: { type: Type.STRING, description: 'Số điện thoại chăm sóc khách hàng' },
    powerCompanyTaxCode: { type: Type.STRING, description: 'Mã số thuế đơn vị điện lực' },
    repairPhone: { type: Type.STRING, description: 'Số điện thoại sửa chữa (ĐT SC)' },

    invoiceTitle: { type: Type.STRING, description: 'Tiêu đề hóa đơn (VD: HÓA ĐƠN GTGT (TIỀN ĐIỆN))' },
    formCode: { type: Type.STRING, description: 'Mẫu số hóa đơn (VD: 01GTKT0/001)' },
    serialCode: { type: Type.STRING, description: 'Ký hiệu hóa đơn (VD: AB/17E)' },
    invoiceNumber: { type: Type.STRING, description: 'Số hóa đơn (VD: 4649163)' },
    invoiceId: { type: Type.STRING, description: 'ID hóa đơn (ID HĐ)' },

    batch: { type: Type.STRING, description: 'Đợt (VD: 1)' },
    month: { type: Type.STRING, description: 'Tháng (VD: 11/2017)' },
    billingCycle: { type: Type.STRING, description: 'Kỳ hóa đơn (VD: 12/2017)' },
    fromDate: { type: Type.STRING, description: 'Từ ngày (dd/mm/yyyy)' },
    toDate: { type: Type.STRING, description: 'Đến ngày (dd/mm/yyyy)' },

    customerName: { type: Type.STRING, description: 'Tên khách hàng (để chuỗi rỗng nếu bị che hoặc trống)' },
    customerAddress: { type: Type.STRING, description: 'Địa chỉ khách hàng' },
    customerPhone: { type: Type.STRING, description: 'Điện thoại khách hàng' },
    customerTaxCode: { type: Type.STRING, description: 'MST khách hàng' },
    customerCode: { type: Type.STRING, description: 'Mã KH' },
    paymentCode: { type: Type.STRING, description: 'Mã thanh toán (Mã T.Toán)' },
    meterSerial: { type: Type.STRING, description: 'Số công tơ' },
    householdCount: { type: Type.STRING, description: 'Số hộ' },
    stationCode: { type: Type.STRING, description: 'Mã trạm' },
    bookDepartment: { type: Type.STRING, description: 'P GCS' },
    sectorCode: { type: Type.STRING, description: 'Mã NN' },
    teamCode: { type: Type.STRING, description: 'Mã tổ' },
    priceCode: { type: Type.STRING, description: 'Mã giá (VD: KT: 100%*SHBT-A)' },
    readingBookNumber: { type: Type.STRING, description: 'Số GCS' },
    voltageLevel: { type: Type.STRING, description: 'Cấp ĐA' },
    meteringPointCode: { type: Type.STRING, description: 'Mã Điểm đo' },
    usageAddress: { type: Type.STRING, description: 'Địa chỉ dùng điện' },

    meterReadings: {
      type: Type.ARRAY,
      description: 'Danh sách các dòng chỉ số công tơ trong bảng chi tiết',
      items: {
        type: Type.OBJECT,
        properties: {
          tariffSet: { type: Type.STRING, description: 'Bộ chỉ số (KT, BT, CD, TD...)' },
          newIndex: { type: Type.NUMBER, description: 'Chỉ số mới (số nguyên, không dùng dấu chấm ngăn cách hàng nghìn)' },
          oldIndex: { type: Type.NUMBER, description: 'Chỉ số cũ (số nguyên)' },
          multiplier: { type: Type.NUMBER, description: 'Hệ số nhân' },
          consumedKwh: { type: Type.NUMBER, description: 'ĐN tiêu thụ (kWh)' },
          directKwh: { type: Type.NUMBER, description: 'ĐN trực tiếp (kWh)' },
          deductedKwh: { type: Type.NUMBER, description: 'ĐN trừ phụ (kWh)' },
          billedKwh: { type: Type.NUMBER, description: 'ĐN tính giá (kWh)' },
        },
        required: ['tariffSet', 'newIndex', 'oldIndex', 'multiplier', 'consumedKwh', 'directKwh', 'deductedKwh', 'billedKwh'],
      },
    },

    tiers: {
      type: Type.ARRAY,
      description: 'Chi tiết các bậc thang giá điện hoặc biểu giá theo giờ',
      items: {
        type: Type.OBJECT,
        properties: {
          tierName: { type: Type.STRING, description: 'Tên bậc (VD: Bậc 1, Bậc 2, Bậc 3...)' },
          kwh: { type: Type.NUMBER, description: 'Sản lượng ĐN tính giá của bậc này (kWh)' },
          unitPrice: { type: Type.NUMBER, description: 'Đơn giá (đồng/kWh, số nguyên, VD: 1.484 -> 1484)' },
          amount: { type: Type.NUMBER, description: 'Thành tiền của bậc này (đồng, số nguyên, VD: 74.200 -> 74200)' },
        },
        required: ['tierName', 'kwh', 'unitPrice', 'amount'],
      },
    },

    totalKwh: { type: Type.NUMBER, description: 'Cộng sản lượng điện tính giá (kWh)' },
    subtotalAmount: { type: Type.NUMBER, description: 'Cộng tiền điện chưa thuế GTGT (đồng, số nguyên)' },
    vatRatePercent: { type: Type.NUMBER, description: 'Thuế suất GTGT (%)' },
    vatAmount: { type: Type.NUMBER, description: 'Tiền thuế GTGT (đồng, số nguyên)' },
    totalAmount: { type: Type.NUMBER, description: 'Tổng tiền thanh toán (đồng, số nguyên)' },
    amountInWords: { type: Type.STRING, description: 'Số tiền bằng chữ' },

    signedDate: { type: Type.STRING, description: 'Ngày ký hóa đơn' },
    signerName: { type: Type.STRING, description: 'Người ký hóa đơn' },
  },
  required: [
    'corporationName',
    'powerCompanyName',
    'invoiceNumber',
    'meterReadings',
    'tiers',
    'totalKwh',
    'subtotalAmount',
    'vatRatePercent',
    'vatAmount',
    'totalAmount',
    'amountInWords',
  ],
};

const SYSTEM_INSTRUCTION = `Bạn là hệ thống OCR chuyên sâu đọc hóa đơn tiền điện Việt Nam (EVNHCMC, EVNHANOI, EVNSPC, EVNCPC, EVNNPC và các đơn vị điện lực).
Hãy trích xuất chính xác toàn bộ thông tin trên hình ảnh hóa đơn theo đúng cấu trúc JSON được yêu cầu.

QUY TẮC QUAN TRỌNG VỀ SỐ LIỆU VIỆT NAM:
1. Trên hóa đơn điện Việt Nam, dấu chấm (.) là dấu phân cách hàng nghìn, KHÔNG phải dấu thập phân.
   Ví dụ: "13.895" là 13895, "13.530" là 13530, "1.484" là 1484, "74.200" là 74200, "716.345" là 716345, "787.980" là 787980.
   Hãy chuyển tất cả các giá trị số về số thuần túy (number) chính xác.
2. Nếu một trường văn bản bị che mờ, trống hoặc không có trên hóa đơn, hãy trả về chuỗi rỗng "".
3. Với bảng bậc thang (tiers), nếu hóa đơn không ghi chữ "Bậc 1", "Bậc 2"... thì tự đánh nhãn theo thứ tự "Bậc 1", "Bậc 2", "Bậc 3"... tương ứng từng dòng đơn giá.
4. Kiểm tra kỹ từng chữ số trên chỉ số công tơ, mã điểm đo, số công tơ, mã thanh toán, ID hóa đơn, đơn giá và thành tiền để không bị nhầm lẫn giữa các số 0/8/6/3/5.`;

function formatGeminiError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return 'Máy chủ nhận diện AI đang quá tải tạm thời. Vui lòng bấm "Thử đọc lại" sau vài giây.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Đã vượt giới hạn lượt gọi API tạm thời. Vui lòng thử lại sau ít phút.';
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return 'Khóa API Gemini chưa hợp lệ hoặc thiếu quyền truy cập. Vui lòng kiểm tra cấu hình trong Settings > Secrets.';
  }
  return raw;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT:${label}`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function parseBillWithRetry(
  ai: GoogleGenAI,
  base64Data: string,
  mimeType: string,
): Promise<ElectricityBillData> {
  const attempts: Array<{ model: string; timeoutMs: number; useThinkingLow: boolean }> = [
    { model: 'gemini-4-hydrogen', timeoutMs: 10000, useThinkingLow: true },
    { model: 'gemini-3.1-flash-lite', timeoutMs: 12000, useThinkingLow: false },
    { model: 'gemini-3.1-flash-lite', timeoutMs: 12000, useThinkingLow: false },
  ];

  let lastError: unknown;

  for (let i = 0; i < attempts.length; i++) {
    const { model, timeoutMs, useThinkingLow } = attempts[i];
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: 'Đọc và trích xuất đầy đủ toàn bộ thông tin trên hóa đơn tiền điện này thành JSON chính xác tuyệt đối.',
              },
            ],
          },
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: billResponseSchema,
            ...(useThinkingLow
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        }),
        timeoutMs,
        model,
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Mô hình không trả về dữ liệu văn bản.');
      }
      const parsed = JSON.parse(rawText) as ElectricityBillData;
      return parsed;
    } catch (err) {
      lastError = err;
      if (i < attempts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/parse-bill', async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType, useSample } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        useSample?: boolean;
      };

      let finalBase64 = '';
      let finalMimeType = mimeType || 'image/png';

      if (useSample) {
        const samplePath = path.join(process.cwd(), 'public/assets/aistudio/image_51f8d943.png');
        const fileBuffer = await fs.readFile(samplePath);
        finalBase64 = fileBuffer.toString('base64');
        finalMimeType = 'image/png';
      } else if (imageBase64) {
        finalBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      } else {
        res.status(400).json({ error: 'Vui lòng cung cấp ảnh hóa đơn tiền điện để phân tích.' });
        return;
      }

      const ai = getGeminiClient();
      const billData = await parseBillWithRetry(ai, finalBase64, finalMimeType);
      const verification = verifyElectricityBill(billData);

      res.json({
        data: billData,
        verification,
      });
    } catch (error) {
      const friendlyMessage = formatGeminiError(error);
      console.error('Lỗi /api/parse-bill:', error);
      res.status(502).json({
        error: `Không thể đọc hóa đơn từ hình ảnh: ${friendlyMessage}`,
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
