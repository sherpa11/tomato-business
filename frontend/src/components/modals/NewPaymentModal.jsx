import React, { useState, useEffect } from 'react';
import { X, CreditCard, AlertCircle, Sparkles } from 'lucide-react';
import { buyersAPI, transactionsAPI } from '../../api/client';
import { useDate } from '../../context/DateContext';
import { formatCurrency, formatBalance } from '../../utils/formatters';
import EditBuyerModal from './EditBuyerModal';

export default function NewPaymentModal({ isOpen, onClose, onSuccess, initialBuyerId = null }) {
  const { operationalDate } = useDate();

  const [buyers, setBuyers] = useState([]);
  const [buyerId, setBuyerId] = useState(initialBuyerId || '');
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [transactionDate, setTransactionDate] = useState(operationalDate);
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [oldBalanceInput, setOldBalanceInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingBuyer, setFetchingBuyer] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTransactionDate(operationalDate);
      setError('');
      setAmountPaid('');
      setOldBalanceInput('');
      setNotes('');

      buyersAPI.getBuyers({ active: true })
        .then((res) => {
          if (res.success && res.buyers) {
            setBuyers(res.buyers);
            const targetId = initialBuyerId || (res.buyers.length > 0 ? res.buyers[0]._id : '');
            const target = res.buyers.find((b) => b._id === targetId);
            if (target) {
              setSelectedBuyer(target);
              setOldBalanceInput(target.currentBalance !== undefined ? String(target.currentBalance) : '0');
            }
            setBuyerId(targetId);
          }
        })
        .catch((err) => console.error('Error fetching buyers:', err));
    }
  }, [isOpen, operationalDate, initialBuyerId]);

  useEffect(() => {
    if (buyerId) {
      if (selectedBuyer && selectedBuyer._id === buyerId) {
        return;
      }
      const existing = buyers.find((b) => b._id === buyerId);
      if (existing) {
        setSelectedBuyer(existing);
        setOldBalanceInput(existing.currentBalance !== undefined ? String(existing.currentBalance) : '0');
        return;
      }
      setFetchingBuyer(true);
      buyersAPI.getBuyerById(buyerId)
        .then((res) => {
          if (res.success && res.buyer) {
            setSelectedBuyer(res.buyer);
            setOldBalanceInput(res.buyer.currentBalance !== undefined ? String(res.buyer.currentBalance) : '0');
          }
        })
        .catch((err) => console.error('Error loading buyer balance:', err))
        .finally(() => setFetchingBuyer(false));
    } else {
      setSelectedBuyer(null);
      setOldBalanceInput('0');
    }
  }, [buyerId, buyers, selectedBuyer]);

  if (!isOpen) return null;

  const oldBalance = oldBalanceInput !== '' ? Number(oldBalanceInput) || 0 : Number(selectedBuyer?.currentBalance || 0);
  const paidNum = Number(amountPaid) || 0;
  const newBalance = Math.round((oldBalance - paidNum + Number.EPSILON) * 100) / 100;

  const oldBalDisplay = formatBalance(oldBalance);
  const newBalDisplay = formatBalance(newBalance);

  const handlePayFullOutstanding = () => {
    if (oldBalance > 0) {
      setAmountPaid(oldBalance.toString());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!buyerId) {
      setError('Please select a buyer');
      return;
    }
    if (paidNum <= 0) {
      setError('Payment amount must be greater than zero');
      return;
    }

    setLoading(true);
    try {
      const res = await transactionsAPI.createPayment({
        buyerId,
        transactionDate,
        amountPaid: paidNum,
        manualOldBalance: oldBalanceInput !== '' ? Number(oldBalanceInput) : null,
        notes
      });

      if (res.success) {
        onSuccess(res.transaction);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3" />

        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center border border-blue-100 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Record Payment Only</h3>
              <p className="text-xs text-slate-500 font-medium">Customer settlement without tomato purchase</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">Buyer / Customer</label>
              {selectedBuyer && (
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(true)}
                  className="text-[11px] text-amber-800 hover:text-amber-900 font-bold hover:underline cursor-pointer"
                  title="Edit Customer Profile"
                >
                  Edit Profile
                </button>
              )}
            </div>
            <select
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              required
              className="w-full h-11 text-sm font-semibold border border-slate-300 rounded-xl px-3 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Select Buyer</option>
              {buyers.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Date</label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
              className="w-full h-11 text-sm font-bold border border-slate-300 rounded-xl px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Old Balance / Previous Outstanding Editable Input */}
          <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200/90">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>Old Balance / Previous Due</span>
                {fetchingBuyer && <span className="text-[10px] text-slate-400 font-normal">(Loading...)</span>}
              </label>
              {selectedBuyer && (
                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                  <span>Ledger:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                    selectedBuyer.currentBalance > 0
                      ? 'bg-amber-100 text-amber-800'
                      : selectedBuyer.currentBalance < 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {formatBalance(selectedBuyer.currentBalance).text}
                  </span>
                  {selectedBuyer.currentBalance !== undefined && Number(oldBalanceInput) !== Number(selectedBuyer.currentBalance) && (
                    <button
                      type="button"
                      onClick={() => setOldBalanceInput(String(selectedBuyer.currentBalance || 0))}
                      className="text-[11px] text-blue-600 hover:text-blue-800 underline font-bold cursor-pointer ml-1"
                      title="Reset to current ledger balance"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="relative rounded-xl shadow-2xs">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-base">
                ₹
              </div>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="0"
                value={oldBalanceInput}
                onChange={(e) => setOldBalanceInput(e.target.value)}
                disabled={!buyerId}
                className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl pl-9 pr-3.5 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Pre-filled from customer ledger. You can manually enter or change the old due before recording payment.
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-700">Amount Received (₹)</label>
              {oldBalance > 0 && (
                <button
                  type="button"
                  onClick={handlePayFullOutstanding}
                  className="text-xs text-blue-700 font-bold hover:underline cursor-pointer"
                >
                  Pay Full ({formatCurrency(oldBalance)})
                </button>
              )}
            </div>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="any"
              placeholder="e.g. 5000"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              required
              className="w-full h-11 text-xl font-black font-mono border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-blue-500 focus:outline-none text-emerald-700"
            />
          </div>

          {/* New Balance Preview */}
          <div className="bg-blue-50/70 border border-blue-200/90 rounded-2xl p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-900 uppercase tracking-wider pb-1.5 border-b border-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Balance Update Preview</span>
            </div>
            <div className="flex justify-between items-center text-xs text-blue-950 font-semibold py-0.5">
              <span>Old Balance:</span>
              <span className="font-mono">{oldBalDisplay.text}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-blue-950 font-semibold py-0.5">
              <span>Payment Received:</span>
              <span className="font-bold font-mono text-emerald-700 text-sm">{formatCurrency(paidNum)}</span>
            </div>
            <div className="pt-2 border-t border-blue-200 flex justify-between items-center">
              <span className="text-sm font-bold text-blue-950">New Balance:</span>
              <span className={`text-lg font-black font-mono px-2.5 py-0.5 rounded-lg border ${newBalDisplay.color}`}>
                {newBalDisplay.text}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Optional Note / Mode</label>
            <input
              type="text"
              placeholder="e.g. Cash, GPay, Bank transfer, Cheque"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-11 px-6 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>

      {/* Edit Customer Profile Modal */}
      <EditBuyerModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        initialBuyer={selectedBuyer}
        onSuccess={(updated) => {
          setSelectedBuyer(updated);
          setOldBalanceInput(String(updated.currentBalance || 0));
        }}
      />
    </div>
  );
}
