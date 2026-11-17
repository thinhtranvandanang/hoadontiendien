import type {
  BillVerificationCheck,
  BillVerificationSummary,
  ElectricityBillData,
} from '../types/bill.ts';

export function verifyElectricityBill(bill: ElectricityBillData): BillVerificationSummary {
  const checks: BillVerificationCheck[] = [];

  // 1. Meter readings delta check: sum((new - old) * multiplier) vs totalConsumed
  if (bill.meterReadings.length > 0) {
    const calculatedConsumed = bill.meterReadings.reduce((acc, row) => {
      const diff = Math.max(0, row.newIndex - row.oldIndex);
      const mult = row.multiplier > 0 ? row.multiplier : 1;
      return acc + Math.round(diff * mult);
    }, 0);
    const reportedConsumed = bill.meterReadings.reduce(
      (acc, row) => acc + (row.consumedKwh || 0),
      0,
    );

    checks.push({
      id: 'meter-delta',
      label: 'Chênh lệch chỉ số công tơ',
      expected: calculatedConsumed,
      actual: reportedConsumed,
      passed: Math.abs(calculatedConsumed - reportedConsumed) <= 1,
      unit: 'kWh',
    });
  }

  // 2. Sum of tiered kWh vs totalKwh
  if (bill.tiers.length > 0) {
    const sumTierKwh = bill.tiers.reduce((acc, tier) => acc + (tier.kwh || 0), 0);
    checks.push({
      id: 'tier-kwh',
      label: 'Tổng sản lượng các bậc thang',
      expected: sumTierKwh,
      actual: bill.totalKwh,
      passed: Math.abs(sumTierKwh - bill.totalKwh) <= 1,
      unit: 'kWh',
    });

    // 3. Sum of tier amounts vs subtotalAmount
    const sumTierAmount = bill.tiers.reduce((acc, tier) => acc + (tier.amount || 0), 0);
    checks.push({
      id: 'tier-subtotal',
      label: 'Tổng thành tiền trước thuế',
      expected: sumTierAmount,
      actual: bill.subtotalAmount,
      passed: Math.abs(sumTierAmount - bill.subtotalAmount) <= 50,
      unit: '₫',
    });
  }

  // 4. Subtotal + VAT vs Total Amount
  const expectedTotal = Math.round(bill.subtotalAmount + bill.vatAmount);
  checks.push({
    id: 'vat-total',
    label: 'Cộng tiền điện + Thuế GTGT',
    expected: expectedTotal,
    actual: bill.totalAmount,
    passed: Math.abs(expectedTotal - bill.totalAmount) <= 50,
    unit: '₫',
  });

  return {
    allPassed: checks.every((c) => c.passed),
    checks,
  };
}

export function formatVnd(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('vi-VN').format(Math.round(value));
}

export function formatKwh(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
}
