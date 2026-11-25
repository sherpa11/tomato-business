import React from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export default function BoxRatesTable({ boxRates = [], searchTerm = '' }) {
  const totalBig = boxRates.reduce((sum, r) => sum + (Number(r.bigBoxes) || 0), 0);
  const totalSmall = boxRates.reduce((sum, r) => sum + (Number(r.smallBoxes) || 0), 0);
  const totalEquivalent = Math.round((totalBig + totalSmall / 2 + Number.EPSILON) * 10) / 10;

  if (boxRates.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 border border-red-100">
          <Package className="w-6 h-6" />
        </div>
        <h3 className="text-sm sm:text-base font-bold text-slate-900">
          {searchTerm ? 'No matching box purchases found' : 'No box purchases for this date'}
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          {searchTerm
            ? `No buyers matching "${searchTerm}" purchased boxes on this date.`
            : 'When tomato sale bills are recorded for this operational date, boxes purchased by rate will appear here.'}
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
            {boxRates.length} {boxRates.length === 1 ? 'Rate Entry' : 'Rate Entries'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <span className="text-slate-500">Total Volume:</span>
          <span className="font-mono font-black text-red-700 text-sm">
            {totalBig > 0 && `${totalBig} Big`}
            {totalBig > 0 && totalSmall > 0 && ' + '}
            {totalSmall > 0 && `${totalSmall} Small`}
            {totalEquivalent > 0 && ` (${totalEquivalent} Big Eq)`}
          </span>
        </div>
      </div>

      {/* Table (Responsive Desktop & Mobile) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
              <th className="py-3 px-4 sm:px-6 text-left">Buyer</th>
              <th className="py-3 px-4 sm:px-6 text-right">Boxes</th>
              <th className="py-3 px-4 sm:px-6 text-right">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {boxRates.map((r, idx) => {
              const buyerLink = r.buyerId ? `/buyers/${r.buyerId}` : null;

              // Format box label strictly
              let boxesLabel = '';
              if (r.bigBoxes > 0 && r.smallBoxes > 0) {
                boxesLabel = `${r.bigBoxes} Big + ${r.smallBoxes} Small`;
              } else if (r.bigBoxes > 0) {
                boxesLabel = `${r.bigBoxes} Big`;
              } else if (r.smallBoxes > 0) {
                boxesLabel = `${r.smallBoxes} Small`;
              } else {
                boxesLabel = '0 Boxes';
              }

              return (
                <tr key={`${r.buyerId || r.buyerName}_${r.rate}_${idx}`} className="hover:bg-slate-50/80 transition-colors">
                  {/* Buyer Name */}
                  <td className="py-3.5 px-4 sm:px-6 text-left">
                    {buyerLink ? (
                      <Link
                        to={buyerLink}
                        className="font-bold text-slate-900 hover:text-red-600 inline-flex items-center gap-1.5 transition-colors group"
                      >
                        <span>{r.buyerName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ) : (
                      <span className="font-bold text-slate-900">{r.buyerName}</span>
                    )}
                  </td>

                  {/* Boxes Quantity */}
                  <td className="py-3.5 px-4 sm:px-6 text-right">
                    <span className="inline-block font-mono font-extrabold text-xs sm:text-sm px-2.5 py-0.5 rounded-lg bg-red-50 text-red-700 border border-red-200/60">
                      {boxesLabel}
                    </span>
                  </td>

                  {/* Individual Selling Rate per Box (Strict Whole Rupee, Never Averaged) */}
                  <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-black text-sm sm:text-base text-slate-900">
                    {formatCurrency(r.rate)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer Total */}
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold text-slate-800">
              <td className="py-3.5 px-4 sm:px-6 text-left uppercase tracking-wider">
                Total
              </td>
              <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-black text-xs sm:text-sm text-red-700">
                {totalBig > 0 && `${totalBig} Big`}
                {totalBig > 0 && totalSmall > 0 && ' + '}
                {totalSmall > 0 && `${totalSmall} Small`}
              </td>
              <td className="py-3.5 px-4 sm:px-6 text-right text-slate-400 font-mono">
                —
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
