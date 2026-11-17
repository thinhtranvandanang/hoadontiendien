export interface MeterReadingRow {
  tariffSet: string;
  newIndex: number;
  oldIndex: number;
  multiplier: number;
  consumedKwh: number;
  directKwh: number;
  deductedKwh: number;
  billedKwh: number;
}

export interface ElectricityTier {
  tierName: string;
  kwh: number;
  unitPrice: number;
  amount: number;
}

export interface ElectricityBillData {
  corporationName: string;
  powerCompanyName: string;
  powerCompanyAddress: string;
  powerCompanyPhone: string;
  powerCompanyTaxCode: string;
  repairPhone: string;

  invoiceTitle: string;
  formCode: string;
  serialCode: string;
  invoiceNumber: string;
  invoiceId: string;

  batch: string;
  month: string;
  billingCycle: string;
  fromDate: string;
  toDate: string;

  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerTaxCode: string;
  customerCode: string;
  paymentCode: string;
  meterSerial: string;
  householdCount: string;
  stationCode: string;
  bookDepartment: string;
  sectorCode: string;
  teamCode: string;
  priceCode: string;
  readingBookNumber: string;
  voltageLevel: string;
  meteringPointCode: string;
  usageAddress: string;

  meterReadings: MeterReadingRow[];
  tiers: ElectricityTier[];

  totalKwh: number;
  subtotalAmount: number;
  vatRatePercent: number;
  vatAmount: number;
  totalAmount: number;
  amountInWords: string;

  signedDate: string;
  signerName: string;
}

export interface BillVerificationCheck {
  id: string;
  label: string;
  expected: number;
  actual: number;
  passed: boolean;
  unit: string;
}

export interface BillVerificationSummary {
  allPassed: boolean;
  checks: BillVerificationCheck[];
}

export interface ParsedBillRecord {
  id: string;
  fileName: string;
  imageUrl: string;
  parsedAt: string;
  data: ElectricityBillData;
  verification: BillVerificationSummary;
}
