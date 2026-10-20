import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  History as HistoryIcon,
  Truck,
  Receipt,
  CreditCard,
  Printer,
  Ban,
  AlertCircle
} from 'lucide-react';
import { purchasesAPI, transactionsAPI } from '../api/client';
import { useDate } from '../context/DateContext';
import { useSettings } from '../context/SettingsContext';
import PrintModal from '../components/print/PrintModal';
import BuyerBillTemplate from '../components/print/BuyerBillTemplate';
import SupplierVoucherTemplate from '../components/print/SupplierVoucherTemplate';
import ConfirmModal from '../components/modals/ConfirmModal';
import { formatCurrency, formatDate, formatBoxDescription, formatBalance } from '../utils/formatters';

export default function History() {
  const { operationalDate } = useDate();
  const { settings } = useSettings();

  const [selectedDate, setSelectedDate] = useState(operationalDate);
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Print
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printItem, setPrintItem] = useState(null);
  const [printType, setPrintType] = useState('BUYER');

  // Void
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidItem, setVoidItem] = useState(null);
  const [voidType, setVoidType] = useState('TRANSACTION');
  const [voidReason, setVoidReason] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [purRes, txRes] = await Promise.all([
        purchasesAPI.getPurchases({ date: selectedDate }),
        transactionsAPI.getTransactions({ date: selectedDate })
      ]);

      if (purRes.success) {
        setPurchases(purRes.purchases);
      }
      if (txRes.success) {
        const allTx = txRes.transactions;
        setSales(allTx.filter((t) => t.type === 'SALE'));
        setPayments(allTx.filter((t) => t.type === 'PAYMENT'));
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch historical records');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handlePrintSale = (s) => {
    setPrintItem(s);
    setPrintType('BUYER');
    setPrintModalOpen(true);
  };

  const handlePrintPurchase = (p) => {
    setPrintItem(p);
    setPrintType('SUPPLIER');
    setPrintModalOpen(true);
  };

  const promptVoid = (item, type) => {
    setVoidItem(item);
    setVoidType(type);
    setVoidReason('');
    setVoidModalOpen(true);
  };

  const executeVoid = async () => {
    if (!voidItem) return;
    try {
      if (voidType === 'TRANSACTION') {
        await transactionsAPI.voidTransaction(voidItem._id, { voidReason });
      } else {
        await purchasesAPI.voidPurchase(voidItem._id, { voidReason });
      }
      setVoidModalOpen(false);
      fetchHistory();
    } catch (err) {
      alert(err.message || 'Failed to void record');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & Date Picker */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-purple-50 text-purple-700 rounded-xl flex items-center justify-center border border-purple-100 shrink-0">
            <HistoryIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Date-wise Transaction History</h1>
            <p className="text-xs text-slate-500 font-medium">Inspect all purchases, sales, and payments for any date</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 p-1.5 rounded-xl">
          <div className="flex items-center gap-1.5 pl-2 text-slate-500">
            <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700">Date:</span>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
          <button
            onClick={() => setSelectedDate(operationalDate)}
            className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white text-purple-700 hover:bg-purple-50 border border-purple-200 cursor-pointer shadow-2xs"
          >
            Today
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* 1. PURCHASES FOR SELECTED DATE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
              Supplier Purchases ({purchases.length})
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 text-left">Supplier</th>
                  <th className="py-3 px-4 text-center">Boxes</th>
                  <th className="py-3 px-4 text-right">Purchase Rate</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-left">Notes</th>
                  <th className="no-print py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-xs text-slate-400">
                      No purchases on {formatDate(selectedDate)}
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr
                      key={p._id}
                      className={p.isVoid ? 'opacity-40 line-through bg-red-50/20' : 'hover:bg-slate-50/80 transition-colors'}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-left">{p.supplierName}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-semibold text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full font-mono">
                          {formatBoxDescription(p.bigBoxes, p.smallBoxes)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-700">
                        {formatCurrency(p.ratePerBigBox)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black font-mono text-emerald-700 text-base">
                        {formatCurrency(p.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 text-left">{p.notes || '—'}</td>
                      <td className="no-print py-3.5 px-4 text-center">
                        {!p.isVoid && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handlePrintPurchase(p)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200/80 bg-white transition-all cursor-pointer shadow-2xs"
                              title="Print"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => promptVoid(p, 'PURCHASE')}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-700 hover:bg-red-50 border border-slate-200/80 bg-white transition-all cursor-pointer shadow-2xs"
                              title="Void"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. SALES FOR SELECTED DATE */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-red-600" />
            <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
              Buyer Sales ({sales.length})
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 text-left">Buyer</th>
                  <th className="py-3 px-4 text-center">Boxes</th>
                  <th className="py-3 px-4 text-right">Selling Rate</th>
                  <th className="py-3 px-4 text-right">Bill</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">New Balance</th>
                  <th className="no-print py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-6 text-center text-xs text-slate-400">
                      No sales on {formatDate(selectedDate)}
                    </td>
                  </tr>
                ) : (
                  sales.map((s) => {
                    const newBal = formatBalance(s.newBalance);
                    return (
                      <tr
                        key={s._id}
                        className={s.isVoid ? 'opacity-40 line-through bg-red-50/20' : 'hover:bg-slate-50/80 transition-colors'}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900 text-left">{s.buyerName}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-xs text-red-700">
                          <span className="bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-mono">
                            {formatBoxDescription(s.bigBoxes, s.smallBoxes)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-700">
                          {formatCurrency(s.ratePerBigBox)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black font-mono text-slate-900">
                          {formatCurrency(s.billAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold font-mono text-emerald-700">
                          {formatCurrency(s.amountPaid)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`inline-block font-mono font-black text-xs px-2.5 py-0.5 rounded-lg border ${newBal.color}`}
                          >
                            {newBal.text}
                          </span>
                        </td>
                        <td className="no-print py-3.5 px-4 text-center">
                          {!s.isVoid && (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handlePrintSale(s)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200/80 bg-white transition-all cursor-pointer shadow-2xs"
                                title="Print Bill"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => promptVoid(s, 'TRANSACTION')}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-700 hover:bg-red-50 border border-slate-200/80 bg-white transition-all cursor-pointer shadow-2xs"
                                title="Void"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. PAYMENTS FOR SELECTED DATE */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
              Payments Received ({payments.length})
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 text-left">Buyer</th>
                  <th className="py-3 px-4 text-right">Payment Amount</th>
                  <th className="py-3 px-4 text-right">New Balance</th>
                  <th className="py-3 px-4 text-left">Notes</th>
                  <th className="no-print py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-6 text-center text-xs text-slate-400">
                      No payments-only recorded on {formatDate(selectedDate)}
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const newBal = formatBalance(p.newBalance);
                    return (
                      <tr
                        key={p._id}
                        className={p.isVoid ? 'opacity-40 line-through bg-red-50/20' : 'hover:bg-slate-50/80 transition-colors'}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900 text-left">{p.buyerName}</td>
                        <td className="py-3.5 px-4 text-right font-black font-mono text-emerald-700 text-base">
                          {formatCurrency(p.amountPaid)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`inline-block font-mono font-black text-xs px-2.5 py-0.5 rounded-lg border ${newBal.color}`}
                          >
                            {newBal.text}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 text-left">{p.notes || '—'}</td>
                        <td className="no-print py-3.5 px-4 text-center">
                          {!p.isVoid && (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handlePrintSale(p)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200/80 bg-white transition-all cursor-pointer shadow-2xs"
                                title="Print Receipt"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => promptVoid(p, 'TRANSACTION')}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-700 hover:bg-red-50 border border-slate-200/80 bg-white transition-all cursor-pointer shadow-2xs"
                                title="Void"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Print Modal */}
      <PrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title={printType === 'BUYER' ? 'Buyer Bill' : 'Supplier Voucher'}
      >
        {printType === 'BUYER' ? (
          <BuyerBillTemplate transaction={printItem} settings={settings} />
        ) : (
          <SupplierVoucherTemplate purchase={printItem} settings={settings} />
        )}
      </PrintModal>

      {/* Confirm Void Modal */}
      <ConfirmModal
        isOpen={voidModalOpen}
        title="Void Record?"
        message="Are you sure you want to void this record? Buyer balances will be recalculated chronologically."
        confirmText="Void Record"
        needsReason={true}
        reasonValue={voidReason}
        onReasonChange={setVoidReason}
        onConfirm={executeVoid}
        onCancel={() => setVoidModalOpen(false)}
      />
    </div>
  );
}
