import React from 'react';
import { formatCurrency, formatDate, formatBalance } from '../../utils/formatters';

export default function BuyerStatementTemplate({ buyer, ledgerEntries = [], settings = {} }) {
  if (!buyer) return null;

  // Calculate chronological closing balance from the last non-void ledger entry for this view/range
  const nonVoidEntries = (ledgerEntries || []).filter((e) => !e.isVoid);
  const lastEntry = nonVoidEntries[nonVoidEntries.length - 1];
  const statementClosingBalance = lastEntry && (lastEntry.balance !== undefined || lastEntry.newBalance !== undefined)
    ? Number(lastEntry.balance !== undefined ? lastEntry.balance : lastEntry.newBalance)
    : Number(buyer.currentBalance !== undefined ? buyer.currentBalance : (buyer.initialBalance || 0));

  const currentBal = formatBalance(statementClosingBalance);

  // Totals for the statement table
  const totalDebit = nonVoidEntries.reduce((sum, r) => sum + (Number(r.debit) || 0), 0);
  const totalCredit = nonVoidEntries.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 12mm 10mm;
        }
        @media print {
          html, body {
            width: 210mm !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          .print-container.a4-bill {
            width: 100% !important;
            max-width: 210mm !important;
            padding: 8mm 6mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="print-container a4-bill bg-white text-black p-6 sm:p-8 font-sans text-sm w-full box-border">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 break-words leading-tight">
              {settings.businessName || 'மகாலட்சுமி தக்காளி கமிஷன் மண்டி'}
            </h1>
            <p className="text-xs text-slate-600 mt-1">{settings.address || 'shop no : 25, Gandhi Market, Dindigul, 624001'}</p>
            <p className="text-xs text-slate-600">Phone: {settings.phone || '94434 01838, 99438 01838'}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-block text-xs font-bold uppercase tracking-wider bg-slate-900 text-white px-3 py-1 rounded shadow-2xs whitespace-nowrap">
              Customer Statement / பேரேடு அறிக்கை
            </span>
            <p className="text-xs text-slate-500 font-mono mt-1.5 font-semibold">
              Date: {new Date().toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>

        {/* Customer Info & Balance Card */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex justify-between items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase text-slate-500 font-bold tracking-wider">Statement For / வாடிக்கையாளர்:</p>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 break-words mt-0.5">{buyer.name}</h2>
            {buyer.phone && <p className="text-xs text-slate-600 font-mono mt-0.5">Phone: {buyer.phone}</p>}
            {buyer.address && <p className="text-xs text-slate-600 mt-0.5">{buyer.address}</p>}
          </div>
          <div className="text-right shrink-0 bg-white px-3.5 py-2.5 rounded-lg border border-slate-200 shadow-2xs">
            <p className="text-[11px] uppercase text-slate-500 font-bold tracking-wider">பாக்கி / Statement Balance:</p>
            <p className={`text-xl sm:text-2xl font-black font-mono mt-0.5 ${currentBal.color || 'text-slate-900'}`}>{currentBal.text}</p>
          </div>
        </div>

        {/* Ledger Table */}
        <table className="w-full text-left border-collapse mb-6">
          <thead>
            <tr className="border-b-2 border-slate-900 text-xs uppercase font-extrabold text-slate-800 bg-slate-100">
              <th className="py-2.5 px-3 w-28 whitespace-nowrap">Date</th>
              <th className="py-2.5 px-3">Description</th>
              <th className="py-2.5 px-3 text-right w-28 whitespace-nowrap">Debit (Bill)</th>
              <th className="py-2.5 px-3 text-right w-28 whitespace-nowrap">Credit (Paid)</th>
              <th className="py-2.5 px-3 text-right w-36 whitespace-nowrap">பாக்கி (Balance)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs font-mono">
            {ledgerEntries.map((row, idx) => {
              const rowBalVal = row.balance !== undefined ? row.balance : row.newBalance;
              const rowBal = formatBalance(rowBalVal);
              return (
                <tr key={row._id || row.id || idx} className={row.isVoid ? 'opacity-40 line-through bg-red-50/30' : ''}>
                  <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(row.transactionDate || row.date)}</td>
                  <td className="py-2.5 px-3 font-sans font-medium">{row.description}</td>
                  <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                    {Number(row.debit) > 0 ? formatCurrency(row.debit) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                    {Number(row.credit) > 0 ? formatCurrency(row.credit) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">{rowBal.text}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-900 bg-slate-50 font-mono text-xs font-bold text-slate-900">
              <td colSpan="2" className="py-2.5 px-3 text-right font-sans uppercase">Total / மொத்தம்:</td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap">{totalDebit > 0 ? formatCurrency(totalDebit) : '—'}</td>
              <td className="py-2.5 px-3 text-right text-emerald-700 whitespace-nowrap">{totalCredit > 0 ? formatCurrency(totalCredit) : '—'}</td>
              <td className="py-2.5 px-3 text-right font-black text-sm text-red-700 whitespace-nowrap">{currentBal.text}</td>
            </tr>
          </tfoot>
        </table>

        {/* Signoff */}
        <div className="pt-8 flex justify-between items-end border-t border-slate-200 text-xs text-slate-500">
          <div>
            <p className="font-semibold text-slate-700">All figures are in Indian Rupees (INR)</p>
            <p className="text-[11px] mt-0.5">Computer generated account statement.</p>
          </div>
          <div className="text-center">
            <div className="w-44 border-b border-slate-400 mb-1.5"></div>
            <p className="font-bold text-slate-800 uppercase text-[10px]">Authorized Signature</p>
          </div>
        </div>
      </div>
    </>
  );
}
