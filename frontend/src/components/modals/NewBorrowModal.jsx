import React, { useState, useEffect } from 'react';
import { X, HandCoins, AlertCircle, ArrowUpRight } from 'lucide-react';
import { buyersAPI, transactionsAPI } from '../../api/client';
import { useDate } from '../../context/DateContext';
import { formatCurrency, formatBalance } from '../../utils/formatters';

export default function NewBorrowModal({ isOpen, onClose, onSuccess, initialBuyerId = null }) {
  const { operationalDate } = useDate();

  const [buyers, setBuyers] = useState([]);
  const [buyerId, setBuyerId] = useState(initialBuyerId || '');
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [transactionDate, setTransactionDate] = useState(operationalDate);
  const [borrowAmount, setBorrowAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingBuyer, setFetchingBuyer] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setTransactionDate(operationalDate);
    setError('');
    setBorrowAmount('');
    setNotes('');

    if (initialBuyerId) {
      setBuyerId(initialBuyerId);
      setFetchingBuyer(true);
      buyersAPI
        .getBuyerById(initialBuyerId)
        .then((res) => {
          if (res.success && res.buyer) {
            setSelectedBuyer(res.buyer);
          }
        })
        .catch((err) => console.error('Error loading buyer for borrow:', err))
        .finally(() => setFetchingBuyer(false));
    } else {
      buyersAPI
        .getBuyers({ active: true, dropdown: true })
        .then((res) => {
          if (res.success && res.buyers) {
            setBuyers(res.buyers);
            const first = res.buyers[0];
            if (first) {
              setBuyerId(first._id);
              setSelectedBuyer(first);
            }
          }
        })
        .catch((err) => console.error('Error fetching buyers:', err));
    }
  }, [isOpen, operationalDate, initialBuyerId]);

  useEffect(() => {
    if (!isOpen || initialBuyerId) return;

    if (buyerId) {
      const match = buyers.find((b) => String(b._id) === String(buyerId));
      if (match) {
        setSelectedBuyer(match);
      } else {
        setFetchingBuyer(true);
        buyersAPI
          .getBuyerById(buyerId)
          .then((res) => {
            if (res.success && res.buyer) {
              setSelectedBuyer(res.buyer);
            }
          })
          .catch((err) => console.error('Error loading buyer:', err))
          .finally(() => setFetchingBuyer(false));
      }
    }
  }, [isOpen, buyerId, buyers, initialBuyerId]);

  if (!isOpen) return null;

  const currentBalNum = Math.round(Number(selectedBuyer?.currentBalance || 0));
  const borrowAmtNum = Math.round(Number(borrowAmount) || 0);
  const newDueNum = Math.round(currentBalNum + borrowAmtNum);

  const currentBalDisplay = formatBalance(currentBalNum);
  const newDueDisplay = formatBalance(newDueNum);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!buyerId) {
      setError('Please select a buyer');
      return;
    }
    if (borrowAmtNum <= 0) {
      setError('Borrow amount must be greater than zero');
      return;
    }

    setLoading(true);
    try {
      const res = await transactionsAPI.createBorrow({
        buyerId,
        transactionDate,
        amount: borrowAmtNum,
        notes: notes.trim()
      });

      if (res.success) {
        if (onSuccess) onSuccess(res.transaction);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to record borrow entry');
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
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-50 text-purple-700 rounded-xl flex items-center justify-center border border-purple-100 shrink-0">
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Record Buyer Borrow / கடன் பதிவு
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Add separate borrow amount to buyer's outstanding due
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Buyer Display / Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Buyer / வாடிக்கையாளர்
            </label>
            {initialBuyerId && selectedBuyer ? (
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-sm font-black text-slate-900 block">{selectedBuyer.name}</span>
                  {selectedBuyer.phone && (
                    <span className="text-xs text-slate-500 font-mono">{selectedBuyer.phone}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Existing Due</span>
                  <span className={`text-xs font-extrabold font-mono ${currentBalDisplay.color}`}>
                    {currentBalDisplay.text}
                  </span>
                </div>
              </div>
            ) : (
              <select
                value={buyerId}
                onChange={(e) => setBuyerId(e.target.value)}
                className="w-full text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {buyers.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} (Current: ₹{Number(b.currentBalance || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Borrow Amount (₹) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Borrow Amount / கடன் தொகை (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                ₹
              </span>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                required
                autoFocus
                placeholder="e.g. 2000"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full pl-8 pr-4 py-2.5 text-base sm:text-lg font-black font-mono text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-2xs"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Enter whole rupee amount. This will be added to the buyer's balance due.
            </p>
          </div>

          {/* Date Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Borrow Date / தேதி
            </label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full text-xs sm:text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
            />
          </div>

          {/* Optional Notes / Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Description / குறிப்பு <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Cash advance, vehicle fare, personal loan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs sm:text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400"
            />
          </div>

          {/* Accounting Impact Summary Card */}
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
              <span>Existing Balance Due:</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(currentBalNum)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-purple-700 font-bold">
              <span className="flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Borrow Amount:
              </span>
              <span className="font-mono font-black">+ {formatCurrency(borrowAmtNum)}</span>
            </div>
            <div className="pt-2 border-t border-purple-200 flex items-center justify-between text-sm">
              <span className="font-extrabold text-slate-900">New Total Due:</span>
              <span className="font-mono font-black text-slate-900">{formatCurrency(newDueNum)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || borrowAmtNum <= 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <HandCoins className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Record Borrow'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
