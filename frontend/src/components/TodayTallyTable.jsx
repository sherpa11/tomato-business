import React from 'react';
import { Link } from 'react-router-dom';
import { Printer, Eye, Ban, Edit2 } from 'lucide-react';
import { formatCurrency, formatBalance } from '../utils/formatters';

export default function TodayTallyTable({ tally, onPrint, onVoid, onEditCustomer, isFiltered = false, searchTerm = '' }) {
  if (!tally || tally.length === 0) {
    if (isFiltered) {
      return (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm font-bold text-slate-700">No customers found</p>
          <p className="mt-1 text-xs text-slate-500">
            No customer rows match "{searchTerm}". Try a different name or clear the search.
          </p>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
        <img src="/tomato.png" alt="Tomato" className="w-12 h-12 object-contain mx-auto drop-shadow-xs opacity-90" />
        <h4 className="mt-3 text-base font-bold text-slate-800">No Sales or Tallies for this Date</h4>
        <p className="mt-1 text-xs text-slate-500">
          Click "+ BUYER BILL" or "+ RECORD PAYMENT" above to begin today's tally.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* MOBILE CARD VIEW (< 640px) */}
      <div className="sm:hidden space-y-3">
        {tally.map((row) => {
          const oldBal = formatBalance(row.oldBalance);
          const newBal = formatBalance(row.newBalance);

          return (
            <div
              key={row.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3"
            >
              {/* Header: Name & Type Badge */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <Link
                    to={`/buyers/${row.buyerId}`}
                    className="font-extrabold text-slate-900 text-base hover:text-red-600 hover:underline block leading-snug"
                  >
                    {row.buyerName}
                  </Link>
                  {row.notes && (
                    <span className="text-xs text-slate-500 block mt-0.5 font-medium line-clamp-1">
                      {row.notes}
                    </span>
                  )}
                </div>
                <div>
                  {row.type === 'SALE' ? (
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-100 font-mono">
                      <span>{row.boxDescription}</span>
                    </div>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                      Payment Only
                    </span>
                  )}
                </div>
              </div>

              {/* 4-Box Financial Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-semibold block text-[11px]">Old Due</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {formatCurrency(row.oldBalance)}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-semibold block text-[11px]">Today's Bill</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {row.todayBill > 0 ? formatCurrency(row.todayBill) : '—'}
                  </span>
                  {row.ratePerBigBox > 0 && (
                    <span className="text-[10px] text-slate-500 block">
                      @ ₹{row.ratePerBigBox}/box
                    </span>
                  )}
                </div>

                <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-emerald-800 font-semibold block text-[11px]">Paid Cash</span>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    {formatCurrency(row.paid)}
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border ${newBal.color} bg-opacity-30`}>
                  <span className="text-slate-600 font-semibold block text-[11px]">New Balance</span>
                  <span className="font-mono font-black text-sm block">
                    {newBal.text}
                  </span>
                </div>
              </div>

              {/* Action Buttons: 44px Touch Targets */}
              <div className="flex items-center justify-between pt-1 gap-2">
                <button
                  onClick={() => onPrint(row)}
                  className="flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 active:scale-95 transition-transform"
                >
                  <Printer className="w-4 h-4 text-red-600" />
                  <span>Print</span>
                </button>

                <Link
                  to={`/buyers/${row.buyerId}`}
                  className="flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 active:scale-95 transition-transform"
                >
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Ledger</span>
                </Link>

                {onEditCustomer && (
                  <button
                    onClick={() => onEditCustomer(row.buyerId)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 bg-slate-50 hover:bg-amber-50 border border-slate-200/90 active:scale-95 transition-transform shrink-0"
                    title="Edit Customer Profile"
                  >
                    <Edit2 className="w-4 h-4 text-amber-600" />
                  </button>
                )}

                <button
                  onClick={() => onVoid(row)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200/90 active:scale-95 transition-transform shrink-0"
                  title="Void Transaction"
                >
                  <Ban className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* TABLE VIEW (Tablet & Desktop >= 640px) */}
      <div className="hidden sm:block bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4 text-left sticky left-0 bg-slate-50/95 z-10 shadow-2xs">Customer</th>
                <th className="py-3 px-4 text-right">Old Balance</th>
                <th className="py-3 px-4 text-center">Today's Boxes</th>
                <th className="py-3 px-4 text-right">Today's Bill</th>
                <th className="py-3 px-4 text-right">Total Due</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">New Balance</th>
                <th className="no-print py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {tally.map((row) => {
                const oldBal = formatBalance(row.oldBalance);
                const newBal = formatBalance(row.newBalance);

                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Customer (Sticky on horizontal scroll) */}
                    <td className="py-3.5 px-4 text-left sticky left-0 bg-white z-10 shadow-2xs">
                      <Link
                        to={`/buyers/${row.buyerId}`}
                        className="font-bold text-slate-900 hover:text-red-600 hover:underline inline-flex items-center gap-1.5"
                      >
                        <span>{row.buyerName}</span>
                      </Link>
                      {row.notes && (
                        <span className="text-[11px] text-slate-500 block truncate max-w-[170px] mt-0.5">
                          {row.notes}
                        </span>
                      )}
                    </td>

                    {/* Old Balance */}
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                      <span className="font-mono">{formatCurrency(row.oldBalance)}</span>
                      {row.oldBalance < 0 && (
                        <span className="block text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                          Credit
                        </span>
                      )}
                    </td>

                    {/* Today's Boxes */}
                    <td className="py-3.5 px-4 text-center">
                      {row.type === 'SALE' ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-100 font-mono">
                          <span>{row.boxDescription}</span>
                          {row.ratePerBigBox > 0 && (
                            <span className="text-[10px] font-normal text-red-600">
                              (@ ₹{row.ratePerBigBox.toLocaleString('en-IN')})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                          Payment Only
                        </span>
                      )}
                    </td>

                    {/* Today's Bill */}
                    <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 font-mono">
                      {row.todayBill > 0 ? formatCurrency(row.todayBill) : '—'}
                    </td>

                    {/* Total Due */}
                    <td className="py-3.5 px-4 text-right font-bold text-slate-800 font-mono">
                      {formatCurrency(row.totalDue)}
                    </td>

                    {/* Paid */}
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700 font-mono">
                      {formatCurrency(row.paid)}
                    </td>

                    {/* New Balance */}
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-block font-black font-mono text-sm px-2.5 py-0.5 rounded-lg border ${newBal.color}`}
                      >
                        {newBal.text}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="no-print py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onPrint(row)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200/80 bg-white transition-all cursor-pointer shadow-2xs"
                          title="Print Bill"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          to={`/buyers/${row.buyerId}`}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200/80 bg-white transition-all shadow-2xs"
                          title="View Account Ledger"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        {onEditCustomer && (
                          <button
                            onClick={() => onEditCustomer(row.buyerId)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-amber-700 hover:bg-amber-50 border border-slate-200/80 bg-white transition-all cursor-pointer shadow-2xs"
                            title="Edit Customer Profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onVoid(row)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-700 hover:bg-red-50 border border-slate-200/80 bg-white transition-all cursor-pointer shadow-2xs"
                          title="Void Transaction"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
