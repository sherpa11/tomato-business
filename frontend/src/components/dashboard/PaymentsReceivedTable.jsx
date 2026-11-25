import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export default function PaymentsReceivedTable({ payments = [], searchTerm = '' }) {
  const totalAmountPaid = payments.reduce((sum, p) => sum + (Number(p.totalPaid) || 0), 0);

  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100">
          <CreditCard className="w-6 h-6" />
        </div>
        <h3 className="text-sm sm:text-base font-bold text-slate-900">
          {searchTerm ? 'No matching payments found' : 'No payments received for this date'}
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          {searchTerm
            ? `No buyers matching "${searchTerm}" made a payment on this date.`
            : 'When payments are recorded for this operational date, they will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Header Summary Bar */}
      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">
            {payments.length} {payments.length === 1 ? 'Buyer' : 'Buyers'} Paid
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <span className="text-slate-500">Total Collected:</span>
          <span className="font-mono font-black text-emerald-700 text-sm">
            {formatCurrency(totalAmountPaid)}
          </span>
        </div>
      </div>

      {/* Table (Responsive Desktop & Mobile) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
              <th className="py-3 px-4 sm:px-6 text-left">Buyer</th>
              <th className="py-3 px-4 sm:px-6 text-right">Amount Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {payments.map((p, idx) => {
              const buyerLink = p.buyerId ? `/buyers/${p.buyerId}` : null;

              return (
                <tr key={p.buyerId || idx} className="hover:bg-slate-50/80 transition-colors">
                  {/* Buyer Name */}
                  <td className="py-3.5 px-4 sm:px-6 text-left">
                    {buyerLink ? (
                      <Link
                        to={buyerLink}
                        className="font-bold text-slate-900 hover:text-red-600 inline-flex items-center gap-1.5 transition-colors group"
                      >
                        <span>{p.buyerName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ) : (
                      <span className="font-bold text-slate-900">{p.buyerName}</span>
                    )}
                  </td>

                  {/* Amount Paid */}
                  <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-black text-sm sm:text-base text-emerald-700">
                    {formatCurrency(p.totalPaid)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer Total */}
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold text-slate-800">
              <td className="py-3.5 px-4 sm:px-6 text-left uppercase tracking-wider">
                Total ({payments.length} {payments.length === 1 ? 'buyer' : 'buyers'})
              </td>
              <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-black text-sm sm:text-base text-emerald-700">
                {formatCurrency(totalAmountPaid)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
