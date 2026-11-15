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
    <div className="print-container a4-bill bg-white text-black p-6 sm:p-8 font-sans text-sm">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
            {settings.businessName || 'மகாலட்சுமி தக்காளி கமிஷன் மண்டி'}
          </h1>
          <p className="text-xs text-slate-600 mt-1">{settings.address || 'shop no : 25, Gandhi Market, Dindigul, 624001'}</p>
          <p className="text-xs text-slate-600">Phone: {settings.phone || '94434 01838, 99438 01838'}</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold uppercase tracking-wider bg-slate-900 text-white px-2.5 py-1 rounded">
            Customer Statement / பேரேடு அறிக்கை
          </span>
          <p className="text-xs text-slate-500 mt-2">Date: {new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-5 flex justify-between items-center">
        <div>
          <p className="text-xs uppercase text-slate-500 font-bold">Statement For / வாடிக்கையாளர்:</p>
          <h2 className="text-lg font-extrabold text-slate-900">{buyer.name}</h2>
          {buyer.phone && <p className="text-xs text-slate-600">Phone: {buyer.phone}</p>}
          {buyer.address && <p className="text-xs text-slate-600">Address: {buyer.address}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-slate-500 font-bold">பாக்கி / Statement Balance:</p>
          <p className={`text-2xl font-black ${currentBal.color || 'text-slate-900'}`}>{currentBal.text}</p>
        </div>
      </div>

      {/* Ledger Table */}
      <table className="w-full text-left border-collapse mb-5">
        <thead>
          <tr className="border-b-2 border-slate-800 text-xs uppercase font-extrabold text-slate-700 bg-slate-100">
            <th className="py-2.5 px-3">Date</th>
            <th className="py-2.5 px-3">Description</th>
            <th className="py-2.5 px-3 text-right">Debit (Bill)</th>
            <th className="py-2.5 px-3 text-right">Credit (Paid)</th>
            <th className="py-2.5 px-3 text-right">பாக்கி (Balance)</th>
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
                <td className="py-2.5 px-3 text-right font-semibold">
                  {Number(row.debit) > 0 ? formatCurrency(row.debit) : '—'}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                  {Number(row.credit) > 0 ? formatCurrency(row.credit) : '—'}
                </td>
                <td className="py-2.5 px-3 text-right font-bold">{rowBal.text}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-900 bg-slate-50 font-mono text-xs font-bold text-slate-900">
            <td colSpan="2" className="py-2.5 px-3 text-right font-sans uppercase">Total / மொத்தம்:</td>
            <td className="py-2.5 px-3 text-right">{totalDebit > 0 ? formatCurrency(totalDebit) : '—'}</td>
            <td className="py-2.5 px-3 text-right text-emerald-700">{totalCredit > 0 ? formatCurrency(totalCredit) : '—'}</td>
            <td className="py-2.5 px-3 text-right font-black text-sm text-red-700">{currentBal.text}</td>
          </tr>
        </tfoot>
      </table>

      {/* Signoff */}
      <div className="pt-8 flex justify-between items-end border-t border-slate-200 text-xs text-slate-500">
        <div>
          <p className="font-semibold">All figures are in Indian Rupees (INR)</p>
          <p className="text-[11px] mt-0.5">Computer generated account statement.</p>
        </div>
        <div className="text-center">
          <div className="w-40 border-b border-slate-400 mb-1"></div>
          <p className="font-bold text-slate-800 uppercase text-[10px]">Authorized Signature</p>
        </div>
      </div>
    </div>
  );
}
