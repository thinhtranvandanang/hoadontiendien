import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Pencil,
  Printer,
  RotateCcw,
  Save,
} from 'lucide-react';
import type {
  BillVerificationSummary,
  ElectricityBillData,
} from '../types/bill.ts';
import { formatKwh, formatVnd } from '../utils/billVerification.ts';

interface BillDisplayPanelProps {
  bill: ElectricityBillData | null;
  verification: BillVerificationSummary | null;
  isLoading: boolean;
  error: string | null;
  activeSection: 'overview' | 'tiers' | 'export';
  onSectionChange: (section: 'overview' | 'tiers' | 'export') => void;
  onUpdateBill: (updated: ElectricityBillData) => void;
  onRetry: () => void;
}

function displayText(val: string | undefined | null): string {
  return val && val.trim().length > 0 ? val.trim() : '—';
}

export const BillDisplayPanel: React.FC<BillDisplayPanelProps> = ({
  bill,
  verification,
  isLoading,
  error,
  activeSection,
  onSectionChange,
  onUpdateBill,
  onRetry,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ElectricityBillData | null>(null);
  const [copied, setCopied] = useState(false);

  const startEdit = () => {
    if (!bill) return;
    setDraft(structuredClone(bill));
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(null);
    setIsEditing(false);
  };

  const saveEdit = () => {
    if (!draft) return;
    onUpdateBill(draft);
    setIsEditing(false);
    setDraft(null);
  };

  const currentBill = isEditing && draft ? draft : bill;

  const handleDownloadJson = () => {
    if (!currentBill) return;
    const blob = new Blob([JSON.stringify(currentBill, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hoa-don-dien-${currentBill.invoiceNumber || 'evn'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    if (!currentBill) return;
    const escapeCsv = (val: string | number) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows: string[][] = [
      ['Thông tin chung', 'Giá trị'],
      ['Đơn vị điện lực', currentBill.powerCompanyName],
      ['Số hóa đơn', currentBill.invoiceNumber],
      ['ID Hóa đơn', currentBill.invoiceId],
      ['Ký hiệu / Mẫu số', `${currentBill.serialCode} / ${currentBill.formCode}`],
      ['Kỳ / Tháng', `${currentBill.billingCycle} (${currentBill.fromDate} - ${currentBill.toDate})`],
      ['Tên khách hàng', currentBill.customerName],
      ['Mã thanh toán', currentBill.paymentCode],
      ['Số công tơ', currentBill.meterSerial],
      ['Mã giá', currentBill.priceCode],
      [],
      ['Bậc thang', 'Sản lượng (kWh)', 'Đơn giá (đ/kWh)', 'Thành tiền (đ)'],
      ...currentBill.tiers.map((t) => [
        t.tierName,
        String(t.kwh),
        String(t.unitPrice),
        String(t.amount),
      ]),
      [],
      ['Tổng sản lượng (kWh)', String(currentBill.totalKwh)],
      ['Tiền điện chưa thuế (đ)', String(currentBill.subtotalAmount)],
      [`Thuế GTGT (${currentBill.vatRatePercent}%)`, String(currentBill.vatAmount)],
      ['Tổng tiền thanh toán (đ)', String(currentBill.totalAmount)],
      ['Số tiền bằng chữ', currentBill.amountInWords],
    ];

    const csvContent =
      '\uFEFF' + rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hoa-don-dien-${currentBill.invoiceNumber || 'evn'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = async () => {
    if (!currentBill) return;
    const text = [
      `HÓA ĐƠN TIỀN ĐIỆN — ${currentBill.powerCompanyName || currentBill.corporationName}`,
      `Số HĐ: ${currentBill.invoiceNumber} | Ký hiệu: ${currentBill.serialCode} | Kỳ: ${currentBill.billingCycle}`,
      `Từ ngày ${currentBill.fromDate} đến ${currentBill.toDate}`,
      `Mã thanh toán: ${currentBill.paymentCode} | Số công tơ: ${currentBill.meterSerial}`,
      `Sản lượng tiêu thụ: ${formatKwh(currentBill.totalKwh)} kWh`,
      `Tiền điện chưa thuế: ${formatVnd(currentBill.subtotalAmount)} đ`,
      `Thuế GTGT (${currentBill.vatRatePercent}%): ${formatVnd(currentBill.vatAmount)} đ`,
      `Tổng thanh toán: ${formatVnd(currentBill.totalAmount)} đ (${currentBill.amountInWords})`,
    ].join('\n');

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6" aria-busy="true">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="p-4 border border-slate-200 rounded-lg space-y-2 animate-pulse">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-6 w-28 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="h-4 w-48 bg-slate-200 rounded" />
          <div className="h-36 w-full bg-slate-100 rounded-lg border border-slate-200" />
          <div className="h-48 w-full bg-slate-100 rounded-lg border border-slate-200" />
        </div>
        <p className="text-xs text-slate-500">
          Đang nhận diện và đối soát các chỉ số trên hóa đơn tiền điện...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Không thể trích xuất hóa đơn
              </h2>
              <p className="text-sm text-slate-600 mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Thử đọc lại</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentBill || !verification) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <h2 className="text-base font-semibold text-slate-900">
          Chưa có dữ liệu hóa đơn
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Hãy tải ảnh hóa đơn tiền điện lên ở khung bên trái hoặc chọn Nạp mẫu EVNHCMC để xem kết quả trích xuất chi tiết.
        </p>
      </div>
    );
  }

  const avgUnitPrice =
    currentBill.totalKwh > 0
      ? Math.round(currentBill.subtotalAmount / currentBill.totalKwh)
      : 0;
  const maxTierAmount = Math.max(
    1,
    ...currentBill.tiers.map((tier) => tier.amount || 0),
  );

  return (
    <div className="space-y-5">
      {/* 4-Column Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">
            Tổng tiền thanh toán
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-blue-900 tracking-tight">
            {formatVnd(currentBill.totalAmount)} <span className="text-sm font-semibold">₫</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Đã gồm VAT {currentBill.vatRatePercent}%
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">
            Điện năng tiêu thụ
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900 tracking-tight">
            {formatKwh(currentBill.totalKwh)} <span className="text-sm font-semibold text-slate-600">kWh</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Bình quân {formatVnd(avgUnitPrice)} ₫/kWh
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">
            Kỳ hóa đơn
          </div>
          <div className="mt-1.5 text-lg font-semibold font-mono tabular-nums text-slate-900 truncate">
            {displayText(currentBill.billingCycle || currentBill.month)}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums truncate">
            {displayText(currentBill.fromDate)} – {displayText(currentBill.toDate)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">
            Đối soát số học
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            {verification.allPassed ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-base font-semibold text-emerald-700">
                  Khớp hoàn toàn
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-base font-semibold text-amber-700">
                  Cần rà soát
                </span>
              </>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {verification.checks.filter((c) => c.passed).length}/{verification.checks.length} phép kiểm tra đạt
          </div>
        </div>
      </div>

      {/* Main Ledger Surface */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Segmented Sub-navigation & Edit Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 bg-slate-50/60 no-print">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => onSectionChange('overview')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'overview'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toàn bộ hóa đơn
            </button>
            <button
              type="button"
              onClick={() => onSectionChange('tiers')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'tiers'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chi tiết bậc thang
            </button>
            <button
              type="button"
              onClick={() => onSectionChange('export')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'export'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đối soát & Xuất file
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isEditing ? (
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Chỉnh sửa số liệu</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu thay đổi</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Section Content */}
        <div className="p-5 sm:p-6 space-y-7">
          {activeSection === 'overview' && (
            <>
              {/* Invoice Header & Issuer */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-blue-800">
                    {displayText(currentBill.corporationName)}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {displayText(currentBill.powerCompanyName)}
                  </h2>
                  <p className="text-xs text-slate-600">
                    {displayText(currentBill.powerCompanyAddress)}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-1">
                    <span>MST: <span className="font-mono text-slate-700">{displayText(currentBill.powerCompanyTaxCode)}</span></span>
                    <span aria-hidden="true">·</span>
                    <span>CSKH: <span className="font-mono text-slate-700">{displayText(currentBill.powerCompanyPhone)}</span></span>
                    {currentBill.repairPhone && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Sửa chữa: <span className="font-mono text-slate-700">{currentBill.repairPhone}</span></span>
                      </>
                    )}
                  </div>
                </div>

                <div className="sm:text-right space-y-1 shrink-0 font-mono tabular-nums text-xs text-slate-600">
                  <div>
                    Mẫu số: <span className="font-semibold text-slate-900">{displayText(currentBill.formCode)}</span>
                  </div>
                  <div>
                    Ký hiệu: <span className="font-semibold text-slate-900">{displayText(currentBill.serialCode)}</span>
                  </div>
                  <div>
                    Số HĐ: <span className="font-semibold text-blue-900">{displayText(currentBill.invoiceNumber)}</span>
                  </div>
                  <div>
                    ID HĐ: <span className="font-semibold text-slate-900">{displayText(currentBill.invoiceId)}</span>
                  </div>
                </div>
              </div>

              {/* Customer & Meter Metadata Grid */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Thông tin khách hàng & Điểm đo
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                  <EditableFieldRow
                    label="Tên khách hàng"
                    value={currentBill.customerName}
                    isEditing={isEditing}
                    onChange={(v) => draft && setDraft({ ...draft, customerName: v })}
                  />
                  <EditableFieldRow
                    label="Mã thanh toán"
                    value={currentBill.paymentCode}
                    mono
                    isEditing={isEditing}
                    onChange={(v) => draft && setDraft({ ...draft, paymentCode: v })}
                  />
                  <EditableFieldRow
                    label="Địa chỉ khách hàng"
                    value={currentBill.customerAddress}
                    isEditing={isEditing}
                    onChange={(v) => draft && setDraft({ ...draft, customerAddress: v })}
                  />
                  <EditableFieldRow
                    label="Số công tơ"
                    value={currentBill.meterSerial}
                    mono
                    isEditing={isEditing}
                    onChange={(v) => draft && setDraft({ ...draft, meterSerial: v })}
                  />
                  <EditableFieldRow
                    label="Mã khách hàng"
                    value={currentBill.customerCode}
                    mono
                    isEditing={isEditing}
                    onChange={(v) => draft && setDraft({ ...draft, customerCode: v })}
                  />
                  <EditableFieldRow
                    label="Mã điểm đo"
                    value={currentBill.meteringPointCode}
                    mono
                    isEditing={isEditing}
                    onChange={(v) => draft && setDraft({ ...draft, meteringPointCode: v })}
                  />
                  <EditableFieldRow
                    label="Mã giá áp dụng"
                    value={currentBill.priceCode}
                    mono
                    isEditing={isEditing}
                    onChange={(v) => draft && setDraft({ ...draft, priceCode: v })}
                  />
                  <EditableFieldRow
                    label="Số hộ / Cấp ĐA"
                    value={
                      currentBill.householdCount || currentBill.voltageLevel
                        ? `${displayText(currentBill.householdCount)} hộ · Cấp ${displayText(currentBill.voltageLevel)}`
                        : ''
                    }
                    mono
                    isEditing={false}
                  />
                  <EditableFieldRow
                    label="Mã trạm / P GCS / Tổ"
                    value={[currentBill.stationCode, currentBill.bookDepartment, currentBill.teamCode]
                      .filter(Boolean)
                      .join(' · ')}
                    mono
                    isEditing={false}
                  />
                  <EditableFieldRow
                    label="Số GCS / Mã NN"
                    value={[currentBill.readingBookNumber, currentBill.sectorCode]
                      .filter(Boolean)
                      .join(' · ')}
                    mono
                    isEditing={false}
                  />
                </div>
              </div>

              {/* Meter Readings Table */}
              <div className="pt-2 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Bảng chỉ số công tơ & Điện năng tiêu thụ
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2.5 px-3 font-semibold">Bộ chỉ số</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Chỉ số mới</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Chỉ số cũ</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Hệ số nhân</th>
                        <th className="py-2.5 px-3 font-semibold text-right">ĐN tiêu thụ</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Trực tiếp</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Trừ phụ</th>
                        <th className="py-2.5 px-3 font-semibold text-right">ĐN tính giá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                      {currentBill.meterReadings.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-4 px-3 text-center text-slate-500 font-sans">
                            Không có bảng chỉ số chi tiết trên hóa đơn này.
                          </td>
                        </tr>
                      ) : (
                        currentBill.meterReadings.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{row.tariffSet || 'KT'}</td>
                            <td className="py-2.5 px-3 text-right text-slate-900">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={row.newIndex}
                                  onChange={(e) => {
                                    if (!draft) return;
                                    const next = [...draft.meterReadings];
                                    next[idx] = { ...next[idx], newIndex: Number(e.target.value) };
                                    setDraft({ ...draft, meterReadings: next });
                                  }}
                                  className="w-20 text-right border border-slate-300 rounded px-1.5 py-0.5 bg-white"
                                />
                              ) : (
                                formatKwh(row.newIndex)
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-700">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={row.oldIndex}
                                  onChange={(e) => {
                                    if (!draft) return;
                                    const next = [...draft.meterReadings];
                                    next[idx] = { ...next[idx], oldIndex: Number(e.target.value) };
                                    setDraft({ ...draft, meterReadings: next });
                                  }}
                                  className="w-20 text-right border border-slate-300 rounded px-1.5 py-0.5 bg-white"
                                />
                              ) : (
                                formatKwh(row.oldIndex)
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{row.multiplier}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                              {formatKwh(row.consumedKwh)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{formatKwh(row.directKwh)}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{formatKwh(row.deductedKwh)}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-blue-900">
                              {formatKwh(row.billedKwh)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {(activeSection === 'overview' || activeSection === 'tiers') && (
            <div className={activeSection === 'overview' ? 'pt-2 border-t border-slate-200' : ''}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Chi tiết tính tiền điện theo bậc thang & Thuế GTGT
                </h3>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Tổng: {formatKwh(currentBill.totalKwh)} kWh
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">Bậc / Biểu giá</th>
                      <th className="py-2.5 px-3 font-semibold text-right">ĐN tính giá (kWh)</th>
                      <th className="py-2.5 px-3 font-semibold hidden sm:table-cell w-40">Tỷ trọng chi phí</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Đơn giá (₫)</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Thành tiền (₫)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono tabular-nums text-xs sm:text-sm">
                    {currentBill.tiers.map((tier, idx) => {
                      const pct =
                        currentBill.subtotalAmount > 0
                          ? Math.round((tier.amount / currentBill.subtotalAmount) * 100)
                          : 0;
                      const barWidth = Math.max(
                        4,
                        Math.round((tier.amount / maxTierAmount) * 100),
                      );
                      return (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                            {tier.tierName || `Bậc ${idx + 1}`}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-900">
                            {isEditing ? (
                              <input
                                type="number"
                                value={tier.kwh}
                                onChange={(e) => {
                                  if (!draft) return;
                                  const next = [...draft.tiers];
                                  next[idx] = { ...next[idx], kwh: Number(e.target.value) };
                                  setDraft({ ...draft, tiers: next });
                                }}
                                className="w-20 text-right border border-slate-300 rounded px-1.5 py-0.5 bg-white"
                              />
                            ) : (
                              formatKwh(tier.kwh)
                            )}
                          </td>
                          <td className="py-2.5 px-3 hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-700 rounded-full"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-9 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700">
                            {isEditing ? (
                              <input
                                type="number"
                                value={tier.unitPrice}
                                onChange={(e) => {
                                  if (!draft) return;
                                  const next = [...draft.tiers];
                                  next[idx] = { ...next[idx], unitPrice: Number(e.target.value) };
                                  setDraft({ ...draft, tiers: next });
                                }}
                                className="w-24 text-right border border-slate-300 rounded px-1.5 py-0.5 bg-white"
                              />
                            ) : (
                              formatVnd(tier.unitPrice)
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                            {isEditing ? (
                              <input
                                type="number"
                                value={tier.amount}
                                onChange={(e) => {
                                  if (!draft) return;
                                  const next = [...draft.tiers];
                                  next[idx] = { ...next[idx], amount: Number(e.target.value) };
                                  setDraft({ ...draft, tiers: next });
                                }}
                                className="w-28 text-right border border-slate-300 rounded px-1.5 py-0.5 bg-white"
                              />
                            ) : (
                              formatVnd(tier.amount)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50/80 border-t border-slate-200 font-mono tabular-nums text-xs sm:text-sm">
                    <tr>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-700">
                        Cộng tiền điện (chưa thuế)
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        {formatKwh(currentBill.totalKwh)}
                      </td>
                      <td className="hidden sm:table-cell" />
                      <td />
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        {formatVnd(currentBill.subtotalAmount)}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200/80">
                      <td colSpan={3} className="py-2.5 px-3 font-sans text-slate-600 hidden sm:table-cell">
                        Thuế suất GTGT: {currentBill.vatRatePercent}%
                      </td>
                      <td colSpan={2} className="py-2.5 px-3 font-sans text-slate-600 sm:hidden">
                        Thuế GTGT ({currentBill.vatRatePercent}%)
                      </td>
                      <td />
                      <td className="py-2.5 px-3 text-right text-slate-800">
                        {formatVnd(currentBill.vatAmount)}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-300 bg-blue-50/60">
                      <td colSpan={3} className="py-3 px-3 font-sans font-bold text-slate-900 hidden sm:table-cell">
                        Tổng tiền thanh toán
                      </td>
                      <td colSpan={2} className="py-3 px-3 font-sans font-bold text-slate-900 sm:hidden">
                        Tổng thanh toán
                      </td>
                      <td />
                      <td className="py-3 px-3 text-right font-bold text-base text-blue-900">
                        {formatVnd(currentBill.totalAmount)} ₫
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 px-1">
                <div>
                  <span className="font-medium text-slate-700">Số tiền bằng chữ: </span>
                  <span className="italic">{displayText(currentBill.amountInWords)}</span>
                </div>
                {currentBill.signedDate && (
                  <div className="shrink-0 font-mono tabular-nums text-slate-500">
                    Ngày ký: {currentBill.signedDate}
                  </div>
                )}
              </div>
              {currentBill.signerName && (
                <div className="mt-1 px-1 text-xs text-slate-500">
                  Người ký: {currentBill.signerName}
                </div>
              )}
            </div>
          )}

          {activeSection === 'export' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Kiểm tra tính nhất quán số học
                </h3>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                  {verification.checks.map((check) => (
                    <div
                      key={check.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs sm:text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        {check.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <span className="font-medium text-slate-800">{check.label}</span>
                      </div>
                      <div className="font-mono tabular-nums text-xs text-slate-600 flex items-center gap-3">
                        <span>
                          Tính toán: <strong className="text-slate-900">{formatVnd(check.expected)} {check.unit}</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Trên hóa đơn: <strong className="text-slate-900">{formatVnd(check.actual)} {check.unit}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Xuất & Chia sẻ dữ liệu hóa đơn
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Tải bảng tính CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải dữ liệu JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Đã sao chép' : 'Sao chép tóm tắt'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Printer className="w-4 h-4" />
                    <span>In phiếu đọc</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface EditableFieldRowProps {
  label: string;
  value: string;
  mono?: boolean;
  isEditing: boolean;
  onChange?: (val: string) => void;
}

const EditableFieldRow: React.FC<EditableFieldRowProps> = ({
  label,
  value,
  mono,
  isEditing,
  onChange,
}) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-slate-100">
    <span className="text-xs text-slate-500 shrink-0">{label}</span>
    {isEditing && onChange ? (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-right text-xs px-2 py-1 border border-slate-300 rounded bg-white text-slate-900 w-56 ${
          mono ? 'font-mono' : ''
        }`}
      />
    ) : (
      <span
        className={`text-right text-xs sm:text-sm text-slate-900 font-medium break-words ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {displayText(value)}
      </span>
    )}
  </div>
);
