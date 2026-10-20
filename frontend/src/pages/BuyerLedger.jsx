import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  Printer,
  Ban,
  Phone,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { buyersAPI, transactionsAPI } from '../api/client';
import { useSettings } from '../context/SettingsContext';
import NewSaleModal from '../components/modals/NewSaleModal';
import NewPaymentModal from '../components/modals/NewPaymentModal';
import EditBuyerModal from '../components/modals/EditBuyerModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import PrintModal from '../components/print/PrintModal';
import BuyerBillTemplate from '../components/print/BuyerBillTemplate';
import BuyerStatementTemplate from '../components/print/BuyerStatementTemplate';
import { formatCurrency, formatBalance, formatDate } from '../utils/formatters';

export default function BuyerLedger() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const [buyer, setBuyer] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [auditMessage, setAuditMessage] = useState('');

  // Edit Buyer Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Delete Buyer Modal state
  const [deleteBuyerModalOpen, setDeleteBuyerModalOpen] = useState(false);
  const [deletingBuyer, setDeletingBuyer] = useState(false);


  // Modals
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Printing
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printMode, setPrintMode] = useState('STATEMENT'); // 'STATEMENT' or 'BILL'
  const [selectedTx, setSelectedTx] = useState(null);

  // Voiding
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidTx, setVoidTx] = useState(null);
  const [voidReason, setVoidReason] = useState('');

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await buyersAPI.getBuyerLedger(id);
      if (res.success) {
        setBuyer(res.buyer);
        setLedgerEntries(res.ledgerEntries);
      }
    } catch (err) {
      setError(err.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const handleAuditRecalculate = async () => {
    setAuditMessage('');
    try {
      const res = await buyersAPI.recalculateBuyer(id);
      if (res.success) {
        setAuditMessage('Ledger verified and recalculated successfully against chronological transactions.');
        fetchLedger();
        setTimeout(() => setAuditMessage(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Audit recalculation failed');
    }
  };

  const handlePrintBill = (tx) => {
    setSelectedTx({
      ...tx,
      buyerName: buyer?.name
    });
    setPrintMode('BILL');
    setPrintModalOpen(true);
  };

  const handlePrintStatement = () => {
    setPrintMode('STATEMENT');
    setPrintModalOpen(true);
  };

  const promptVoid = (tx) => {
    setVoidTx(tx);
    setVoidReason('');
    setVoidModalOpen(true);
  };

  const executeVoid = async () => {
    if (!voidTx) return;
    try {
      await transactionsAPI.voidTransaction(voidTx.transactionId, { voidReason });
      setVoidModalOpen(false);
      fetchLedger();
    } catch (err) {
      alert(err.message || 'Failed to void transaction');
    }
  };

  const executeDeleteBuyer = async () => {
    if (!buyer) return;
    setDeletingBuyer(true);
    try {
      const res = await buyersAPI.deleteBuyer(buyer._id);
      if (res.success) {
        setDeleteBuyerModalOpen(false);
        navigate('/buyers');
      }
    } catch (err) {
      alert(err.message || 'Failed to delete buyer');
    } finally {
      setDeletingBuyer(false);
    }
  };


  const currentBal = formatBalance(buyer?.currentBalance);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center gap-3">
        <Link
          to="/buyers"
          className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Buyer Account & Tally Ledger</h1>
          <p className="text-xs text-slate-500 font-medium">Complete chronological accounting history</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {auditMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{auditMessage}</span>
        </div>
      )}

      {/* Buyer Summary Card */}
      {/* Buyer Summary Card */}
      {buyer && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
          <div className="space-y-3">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center border border-red-100 shrink-0 text-xl sm:text-2xl">
                👤
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{buyer.name}</h2>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    buyer.active !== false
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {buyer.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1 font-medium">
                  {buyer.phone && (
                    <a href={`tel:${buyer.phone}`} className="inline-flex items-center gap-1.5 font-mono text-emerald-700 hover:underline font-bold">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {buyer.phone}
                    </a>
                  )}
                  {buyer.address && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {buyer.address}
                    </span>
                  )}
                  <span>
                    Opening Balance: <strong className="text-slate-800 font-mono font-bold">{formatCurrency(buyer.initialBalance)}</strong>
                  </span>
                </div>
              </div>
            </div>

            {buyer.notes && (
              <p className="text-xs text-slate-600 bg-amber-50/70 border border-amber-200/60 px-3 py-1.5 rounded-xl max-w-xl font-medium">
                <strong className="text-amber-900">Profile Note:</strong> {buyer.notes}
              </p>
            )}
          </div>

          {/* Current Balance Display & Actions Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:shrink-0">
            <div className="text-left sm:text-right bg-slate-50 border border-slate-200/70 p-3 sm:py-2 sm:px-4 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                Current Balance
              </span>
              <span
                className={`inline-block font-black text-2xl sm:text-3xl px-2.5 py-0.5 rounded-lg border mt-1 font-mono ${currentBal.color}`}
              >
                {currentBal.text}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setSaleModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <Receipt className="w-4 h-4 shrink-0" />
                <span>+ Bill</span>
              </button>

              <button
                onClick={() => setPaymentModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>+ Payment</span>
              </button>

              <button
                onClick={handlePrintStatement}
                className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                title="Print Account Statement"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>Statement</span>
              </button>

              <button
                onClick={() => setEditModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-3.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                title="Edit Customer Details"
              >
                <Edit2 className="w-3.5 h-3.5 shrink-0" />
                <span>Edit Profile</span>
              </button>

              <button
                onClick={() => setDeleteBuyerModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-3.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                title="Delete Customer Account"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>Delete</span>
              </button>


              <button
                onClick={handleAuditRecalculate}
                className="col-span-2 sm:col-span-1 h-11 sm:h-10 sm:w-10 flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer text-xs font-bold"
                title="Audit & Recalculate Ledger from chronological history"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="sm:hidden">Recalculate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accounting Ledger Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">
            Chronological Statement Ledger
          </h3>
          <span className="text-xs font-bold text-slate-500 font-mono bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
            {ledgerEntries.length} Transactions
          </span>
        </div>

        {/* MOBILE LEDGER CARDS (< 640px) */}
        <div className="sm:hidden space-y-3">
          {ledgerEntries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
              No transactions yet for this buyer.
            </div>
          ) : (
            ledgerEntries.map((row, idx) => {
              const rowBal = formatBalance(row.balance);
              const isOpening = row.type === 'OPENING';
              const isVoided = row.isVoid;

              return (
                <div
                  key={idx}
                  className={`bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3 ${
                    isVoided ? 'opacity-50 bg-red-50/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-500 block">
                        {formatDate(row.date)}
                      </span>
                      <span className="font-bold text-slate-900 text-sm block mt-0.5">
                        {row.description}
                      </span>
                    </div>
                    <span className={`inline-block font-mono font-black text-xs px-2.5 py-0.5 rounded-lg border ${rowBal.color}`}>
                      {rowBal.text}
                    </span>
                  </div>

                  {row.notes && !isVoided && (
                    <p className="text-xs text-slate-500">{row.notes}</p>
                  )}
                  {isVoided && (
                    <span className="text-[10px] text-red-600 font-extrabold uppercase bg-red-100 px-2 py-0.5 rounded inline-block">
                      Voided: {row.voidReason || 'Cancelled'}
                    </span>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <span className="text-slate-500 text-[11px] block">Debit (Bill)</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                      </span>
                    </div>
                    <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                      <span className="text-emerald-800 text-[11px] block">Credit (Paid)</span>
                      <span className="font-mono font-black text-emerald-700 text-sm">
                        {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                      </span>
                    </div>
                  </div>

                  {!isOpening && !isVoided && (
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => handlePrintBill(row)}
                        className="flex-1 h-9 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200"
                      >
                        <Printer className="w-3.5 h-3.5 text-red-600" />
                        <span>Print Bill</span>
                      </button>
                      <button
                        onClick={() => promptVoid(row)}
                        className="h-9 px-3 rounded-xl flex items-center justify-center gap-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200"
                        title="Void Transaction"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Void</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* TABLE VIEW (Tablet & Desktop >= 640px) */}
        <div className="hidden sm:block bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 text-left">Date</th>
                  <th className="py-3 px-4 text-left">Description</th>
                  <th className="py-3 px-4 text-right">Debit (Bill)</th>
                  <th className="py-3 px-4 text-right">Credit (Paid)</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="no-print py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {ledgerEntries.map((row, idx) => {
                  const rowBal = formatBalance(row.balance);
                  const isOpening = row.type === 'OPENING';
                  const isVoided = row.isVoid;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isVoided ? 'opacity-40 line-through bg-red-50/20' : ''
                      } ${isOpening ? 'bg-slate-50/50 font-semibold' : ''}`}
                    >
                      <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap text-left">
                        {formatDate(row.date)}
                      </td>

                      <td className="py-3.5 px-4 text-left">
                        <span className="font-semibold text-slate-900 block">{row.description}</span>
                        {row.isVoid && (
                          <span className="text-[10px] text-red-600 font-extrabold uppercase bg-red-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                            Voided: {row.voidReason || 'Cancelled'}
                          </span>
                        )}
                        {row.notes && !row.isVoid && (
                          <span className="text-xs text-slate-500 block mt-0.5">{row.notes}</span>
                        )}
                      </td>

                      {/* Debit */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                      </td>

                      {/* Credit */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                        {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                      </td>

                      {/* Balance */}
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-block font-mono font-black text-sm px-2.5 py-0.5 rounded-lg border ${rowBal.color}`}
                        >
                          {rowBal.text}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="no-print py-3.5 px-4 text-center whitespace-nowrap">
                        {!isOpening && !isVoided && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handlePrintBill(row)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200/80 bg-white transition-all cursor-pointer shadow-2xs"
                              title="Print Bill"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => promptVoid(row)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-700 hover:bg-red-50 border border-slate-200/80 bg-white transition-all cursor-pointer shadow-2xs"
                              title="Void Transaction"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Action Modals */}
      <NewSaleModal
        isOpen={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        initialBuyerId={id}
        onSuccess={() => fetchLedger()}
      />

      <NewPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        initialBuyerId={id}
        onSuccess={() => fetchLedger()}
      />

      {/* Print Modal */}
      <PrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title={printMode === 'STATEMENT' ? `${buyer?.name} Statement` : 'Buyer Bill Print'}
      >
        {printMode === 'STATEMENT' ? (
          <BuyerStatementTemplate buyer={buyer} ledgerEntries={ledgerEntries} settings={settings} />
        ) : (
          <BuyerBillTemplate transaction={selectedTx} settings={settings} />
        )}
      </PrintModal>

      {/* Void Confirmation Modal */}
      <ConfirmModal
        isOpen={voidModalOpen}
        title="Void Transaction?"
        message="Voiding this transaction will remove it from financial totals and trigger an automatic chronological recalculation of all subsequent buyer balances."
        confirmText="Void & Recalculate"
        needsReason={true}
        reasonValue={voidReason}
        onReasonChange={setVoidReason}
        onConfirm={executeVoid}
        onCancel={() => setVoidModalOpen(false)}
      />

      {/* Edit Buyer Modal */}
      <EditBuyerModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        initialBuyer={buyer}
        onSuccess={() => fetchLedger()}
      />

      {/* Delete Buyer Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteBuyerModalOpen}
        title={buyer ? `Delete Buyer "${buyer.name}"?` : 'Delete Buyer?'}
        message={
          ledgerEntries.length > 1
            ? `Warning: "${buyer?.name}" has ${ledgerEntries.length - 1} transaction(s) on file with a current balance of ${formatCurrency(buyer?.currentBalance)}. Deleting this buyer will permanently remove their profile and all associated ledger transactions. Are you sure you want to proceed?`
            : `Are you sure you want to permanently delete buyer "${buyer?.name}"? This action cannot be undone.`
        }
        confirmText={deletingBuyer ? 'Deleting...' : 'Delete Buyer'}
        cancelText="Cancel"
        isDanger={true}
        onConfirm={executeDeleteBuyer}
        onCancel={() => {
          if (!deletingBuyer) {
            setDeleteBuyerModalOpen(false);
          }
        }}
      />
    </div>

  );
}
