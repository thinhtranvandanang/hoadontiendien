import React, { useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import type { ParsedBillRecord } from '../types/bill.ts';
import { formatKwh, formatVnd } from '../utils/billVerification.ts';

interface BillHistoryPanelProps {
  records: ParsedBillRecord[];
  activeRecordId: string | null;
  onSelectRecord: (record: ParsedBillRecord) => void;
  onDeleteRecord: (id: string) => void;
}

export const BillHistoryPanel: React.FC<BillHistoryPanelProps> = ({
  records,
  activeRecordId,
  onSelectRecord,
  onDeleteRecord,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((rec) => {
      const d = rec.data;
      return (
        d.invoiceNumber.toLowerCase().includes(q) ||
        d.paymentCode.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.powerCompanyName.toLowerCase().includes(q) ||
        d.billingCycle.toLowerCase().includes(q) ||
        rec.fileName.toLowerCase().includes(q)
      );
    });
  }, [records, query]);

  return (
    <section
      id="history-section"
      aria-label="Lịch sử đọc hóa đơn"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Lịch sử hóa đơn đã đọc
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Lưu trữ tạm trên trình duyệt để so sánh sản lượng và chi phí qua các kỳ.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm số HĐ, mã thanh toán..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 px-6 text-center text-sm text-slate-500">
          {records.length === 0
            ? 'Chưa có hóa đơn nào được lưu trong lịch sử.'
            : 'Không tìm thấy hóa đơn phù hợp với từ khóa.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="py-2.5 px-4 font-semibold">Số hóa đơn</th>
                <th className="py-2.5 px-4 font-semibold">Đơn vị điện lực</th>
                <th className="py-2.5 px-4 font-semibold">Mã thanh toán</th>
                <th className="py-2.5 px-4 font-semibold">Kỳ</th>
                <th className="py-2.5 px-4 font-semibold text-right">Sản lượng</th>
                <th className="py-2.5 px-4 font-semibold text-right">Tổng tiền</th>
                <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((rec) => {
                const isActive = rec.id === activeRecordId;
                return (
                  <tr
                    key={rec.id}
                    onClick={() => onSelectRecord(rec)}
                    className={`cursor-pointer transition-colors ${
                      isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900">
                      {rec.data.invoiceNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-[220px] truncate">
                      {rec.data.powerCompanyName || rec.data.corporationName || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {rec.data.paymentCode || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {rec.data.billingCycle || rec.data.month || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatKwh(rec.data.totalKwh)} kWh
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-blue-900">
                      {formatVnd(rec.data.totalAmount)} ₫
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecord(rec.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                        title="Xóa khỏi lịch sử"
                        aria-label="Xóa khỏi lịch sử"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
