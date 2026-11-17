import type { ElectricityBillData } from './src/types/bill.ts';
import { verifyElectricityBill } from './src/utils/billVerification.ts';

interface AssetsBinding {
  fetch(input: Request | string): Promise<Response>;
}

export interface Env {
  ASSETS: AssetsBinding;
  GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  API_KEY?: string;
}

function resolveApiKey(env: Env): string {
  const fromEnv = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.API_KEY || '';
  if (fromEnv.trim()) return fromEnv.trim();
  const procEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const fromProcess = procEnv?.GEMINI_API_KEY || procEnv?.GOOGLE_API_KEY || procEnv?.API_KEY || '';
  return fromProcess.trim();
}

const SYSTEM_INSTRUCTION = `Bạn là hệ thống OCR chuyên sâu đọc hóa đơn tiền điện Việt Nam (EVNHCMC, EVNHANOI, EVNSPC, EVNCPC, EVNNPC và các đơn vị điện lực).
Hãy trích xuất chính xác toàn bộ thông tin trên hình ảnh hóa đơn theo đúng cấu trúc JSON được yêu cầu.

QUY TẮC QUAN TRỌNG VỀ SỐ LIỆU VIỆT NAM:
1. Trên hóa đơn điện Việt Nam, dấu chấm (.) là dấu phân cách hàng nghìn, KHÔNG phải dấu thập phân.
   Ví dụ: "13.895" là 13895, "13.530" là 13530, "1.484" là 1484, "74.200" là 74200, "716.345" là 716345, "787.980" là 787980.
   Hãy chuyển tất cả các giá trị số về số thuần túy (number) chính xác.
2. Nếu một trường văn bản bị che mờ, trống hoặc không có trên hóa đơn, hãy trả về chuỗi rỗng "".
3. Với bảng bậc thang (tiers), nếu hóa đơn không ghi chữ "Bậc 1", "Bậc 2"... thì tự đánh nhãn theo thứ tự "Bậc 1", "Bậc 2", "Bậc 3"... tương ứng từng dòng đơn giá.
4. Kiểm tra kỹ từng chữ số trên chỉ số công tơ, mã điểm đo, số công tơ, mã thanh toán, ID hóa đơn, đơn giá và thành tiền để không bị nhầm lẫn giữa các số 0/8/6/3/5.`;

const BILL_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    corporationName: { type: 'STRING' },
    powerCompanyName: { type: 'STRING' },
    powerCompanyAddress: { type: 'STRING' },
    powerCompanyPhone: { type: 'STRING' },
    powerCompanyTaxCode: { type: 'STRING' },
    repairPhone: { type: 'STRING' },
    invoiceTitle: { type: 'STRING' },
    formCode: { type: 'STRING' },
    serialCode: { type: 'STRING' },
    invoiceNumber: { type: 'STRING' },
    invoiceId: { type: 'STRING' },
    batch: { type: 'STRING' },
    month: { type: 'STRING' },
    billingCycle: { type: 'STRING' },
    fromDate: { type: 'STRING' },
    toDate: { type: 'STRING' },
    customerName: { type: 'STRING' },
    customerAddress: { type: 'STRING' },
    customerPhone: { type: 'STRING' },
    customerTaxCode: { type: 'STRING' },
    customerCode: { type: 'STRING' },
    paymentCode: { type: 'STRING' },
    meterSerial: { type: 'STRING' },
    householdCount: { type: 'STRING' },
    stationCode: { type: 'STRING' },
    bookDepartment: { type: 'STRING' },
    sectorCode: { type: 'STRING' },
    teamCode: { type: 'STRING' },
    priceCode: { type: 'STRING' },
    readingBookNumber: { type: 'STRING' },
    voltageLevel: { type: 'STRING' },
    meteringPointCode: { type: 'STRING' },
    usageAddress: { type: 'STRING' },
    meterReadings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tariffSet: { type: 'STRING' },
          newIndex: { type: 'NUMBER' },
          oldIndex: { type: 'NUMBER' },
          multiplier: { type: 'NUMBER' },
          consumedKwh: { type: 'NUMBER' },
          directKwh: { type: 'NUMBER' },
          deductedKwh: { type: 'NUMBER' },
          billedKwh: { type: 'NUMBER' },
        },
        required: [
          'tariffSet',
          'newIndex',
          'oldIndex',
          'multiplier',
          'consumedKwh',
          'directKwh',
          'deductedKwh',
          'billedKwh',
        ],
      },
    },
    tiers: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tierName: { type: 'STRING' },
          kwh: { type: 'NUMBER' },
          unitPrice: { type: 'NUMBER' },
          amount: { type: 'NUMBER' },
        },
        required: ['tierName', 'kwh', 'unitPrice', 'amount'],
      },
    },
    totalKwh: { type: 'NUMBER' },
    subtotalAmount: { type: 'NUMBER' },
    vatRatePercent: { type: 'NUMBER' },
    vatAmount: { type: 'NUMBER' },
    totalAmount: { type: 'NUMBER' },
    amountInWords: { type: 'STRING' },
    signedDate: { type: 'STRING' },
    signerName: { type: 'STRING' },
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

async function callGeminiRest(
  apiKey: string,
  model: string,
  base64Data: string,
  mimeType: string,
  timeoutMs: number,
  useThinkingLow: boolean,
): Promise<ElectricityBillData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const generationConfig: Record<string, unknown> = {
      responseMimeType: 'application/json',
      responseSchema: BILL_RESPONSE_SCHEMA,
    };
    if (useThinkingLow) {
      generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
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
        ],
        generationConfig,
      }),
    });

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      error?: { code?: number; message?: string; status?: string };
    };

    if (!res.ok) {
      throw new Error(data.error?.message || `HTTP ${res.status}`);
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!rawText) {
      throw new Error('Mô hình không trả về dữ liệu văn bản.');
    }

    return JSON.parse(rawText) as ElectricityBillData;
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const apiKey = resolveApiKey(env);

    if (url.pathname === '/api/health') {
      const configuredVarNames = Object.keys(env || {}).filter(
        (key) => key !== 'ASSETS' && Boolean((env as unknown as Record<string, unknown>)[key]),
      );
      return jsonResponse({
        ok: true,
        runtime: 'cloudflare-worker',
        hasApiKey: Boolean(apiKey),
        configuredVarNames,
      });
    }

    if (url.pathname === '/api/parse-bill') {
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Phương thức không hợp lệ. Chỉ hỗ trợ POST.' }, 405);
      }

      if (!apiKey) {
        return jsonResponse(
          {
            error:
              'Worker chưa nhận được GEMINI_API_KEY lúc chạy (Runtime). Trên Cloudflare Dashboard, hãy thêm GEMINI_API_KEY ở mục Settings > Variables and Secrets (không phải mục Build variables), sau đó bấm Deploy để áp dụng.',
          },
          500,
        );
      }

      try {
        const body = (await request.json()) as {
          imageBase64?: string;
          mimeType?: string;
          useSample?: boolean;
        };

        let finalBase64 = '';
        let finalMimeType = body.mimeType || 'image/png';

        if (body.useSample) {
          const sampleUrl = new URL('/assets/aistudio/image_51f8d943.png', url.origin);
          const assetRes = await env.ASSETS.fetch(new Request(sampleUrl.toString()));
          if (!assetRes.ok) {
            return jsonResponse(
              { error: 'Không tìm thấy ảnh hóa đơn mẫu trong gói tài nguyên tĩnh.' },
              404,
            );
          }
          const buffer = await assetRes.arrayBuffer();
          finalBase64 = arrayBufferToBase64(buffer);
          finalMimeType = 'image/png';
        } else if (body.imageBase64) {
          finalBase64 = body.imageBase64.includes(',')
            ? body.imageBase64.split(',')[1]
            : body.imageBase64;
        } else {
          return jsonResponse(
            { error: 'Vui lòng cung cấp ảnh hóa đơn tiền điện để phân tích.' },
            400,
          );
        }

        const attempts: Array<{ model: string; timeoutMs: number; useThinkingLow: boolean }> = [
          { model: 'gemini-4-hydrogen', timeoutMs: 9000, useThinkingLow: true },
          { model: 'gemini-3.1-flash-lite', timeoutMs: 12000, useThinkingLow: false },
          { model: 'gemini-3.1-flash-lite', timeoutMs: 12000, useThinkingLow: false },
        ];

        let parsed: ElectricityBillData | null = null;
        let lastError: unknown = null;

        for (const attempt of attempts) {
          try {
            parsed = await callGeminiRest(
              apiKey,
              attempt.model,
              finalBase64,
              finalMimeType,
              attempt.timeoutMs,
              attempt.useThinkingLow,
            );
            break;
          } catch (err) {
            lastError = err;
          }
        }

        if (!parsed) {
          const msg = lastError instanceof Error ? lastError.message : 'Lỗi kết nối Gemini API.';
          return jsonResponse(
            { error: `Không thể đọc hóa đơn từ hình ảnh: ${msg}` },
            502,
          );
        }

        const verification = verifyElectricityBill(parsed);
        return jsonResponse({ data: parsed, verification });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Lỗi không xác định.';
        return jsonResponse({ error: `Không thể đọc hóa đơn: ${msg}` }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
