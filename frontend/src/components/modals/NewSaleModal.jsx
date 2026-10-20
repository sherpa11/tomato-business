import React, { useState, useEffect } from 'react';
import { X, Receipt, AlertCircle, Sparkles } from 'lucide-react';
import { buyersAPI, transactionsAPI } from '../../api/client';
import { useDate } from '../../context/DateContext';
import { useSettings } from '../../context/SettingsContext';
import {
  calculateBigEquivalent,
  formatCurrency,
  formatBalance
} from '../../utils/formatters';
import EditBuyerModal from './EditBuyerModal';

export default function NewSaleModal({ isOpen, onClose, onSuccess, initialBuyerId = null }) {
  const { operationalDate } = useDate();
  const { settings } = useSettings();

  const [buyers, setBuyers] = useState([]);
  const [buyerId, setBuyerId] = useState(initialBuyerId || '');
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [transactionDate, setTransactionDate] = useState(operationalDate);
  const [bigBoxes, setBigBoxes] = useState('');
  const [smallBoxes, setSmallBoxes] = useState('');
  const [ratePerBigBox, setRatePerBigBox] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [oldBalanceInput, setOldBalanceInput] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingBuyer, setFetchingBuyer] = useState(false);
  const [error, setError] = useState('');

  // Fetch active buyers
  useEffect(() => {
    if (isOpen) {
      setTransactionDate(operationalDate);
      setRatePerBigBox(settings.defaultSellingRate?.toString() || '1100');
      setError('');
      setBigBoxes('');
      setSmallBoxes('');
      setAmountPaid('');
      setOldBalanceInput('');
      setNotes('');

      buyersAPI.getBuyers({ active: true })
        .then((res) => {
          if (res.success && res.buyers) {
            setBuyers(res.buyers);
            const targetId = initialBuyerId || (res.buyers.length > 0 ? res.buyers[0]._id : '');
            setBuyerId(targetId);
          }
        })
        .catch((err) => console.error('Error fetching buyers:', err));
    }
  }, [isOpen, operationalDate, settings, initialBuyerId]);

  // Fetch full buyer info & live ledger balance when buyerId changes
  useEffect(() => {
    if (buyerId) {
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
  }, [buyerId]);

  if (!isOpen) return null;

  // Live Calculations (preview for the user; backend strictly computes ledger values)
  const bigNum = Number(bigBoxes) || 0;
  const smallNum = Number(smallBoxes) || 0;
  const rateNum = Number(ratePerBigBox) || 0;
  const paidNum = Number(amountPaid) || 0;

  const oldBalance = oldBalanceInput !== '' ? Number(oldBalanceInput) || 0 : Number(selectedBuyer?.currentBalance || 0);
  const bigEquivalent = calculateBigEquivalent(bigNum, smallNum);
  const todayBill = Math.round((bigEquivalent * rateNum + Number.EPSILON) * 100) / 100;
  const totalDue = Math.round((oldBalance + todayBill + Number.EPSILON) * 100) / 100;
  const newBalance = Math.round((totalDue - paidNum + Number.EPSILON) * 100) / 100;

  const oldBalDisplay = formatBalance(oldBalance);
  const newBalDisplay = formatBalance(newBalance);

  // Quick payment autofill helpers
  const handlePayFull = () => {
    setAmountPaid(totalDue > 0 ? totalDue.toString() : '0');
  };

  const handlePayTodayBill = () => {
    setAmountPaid(todayBill > 0 ? todayBill.toString() : '0');
  };

  const handlePayZero = () => {
    setAmountPaid('0');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!buyerId) {
      setError('Please select a buyer');
      return;
    }
    if (bigNum === 0 && smallNum === 0) {
      setError('A sale requires at least one Big or Small box');
      return;
    }
    if (rateNum <= 0) {
      setError('Selling rate per Big Box must be greater than zero');
      return;
    }
    if (paidNum < 0) {
      setError('Amount paid cannot be negative');
      return;
    }

    setLoading(true);
    try {
      const res = await transactionsAPI.createSale({
        buyerId,
        transactionDate,
        bigBoxes: bigNum,
        smallBoxes: smallNum,
        ratePerBigBox: rateNum,
        amountPaid: paidNum,
        manualOldBalance: oldBalanceInput !== '' ? Number(oldBalanceInput) : null,
        notes
      });

      if (res.success) {
        onSuccess(res.transaction);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to record sale');
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
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3" />

        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-100 shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Create Buyer Bill & Tally</h3>
              <p className="text-xs text-slate-500 font-medium">Automatic box conversion & balance tally</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="w-full h-11 text-sm font-semibold border border-slate-300 rounded-xl px-3 bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
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
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Billing Date</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
                className="w-full h-11 text-sm font-bold border border-slate-300 rounded-xl px-3 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Old Balance / Previous Due Editable Input */}
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
                className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl pl-9 pr-3.5 bg-white text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Pre-filled from customer ledger. You can manually enter or change the old due for this bill.
            </p>
          </div>

          {/* Box inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Big Boxes <span className="text-slate-500 font-normal">(1 Big = 1)</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="0"
                value={bigBoxes}
                onChange={(e) => setBigBoxes(e.target.value)}
                className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Small Boxes <span className="text-slate-500 font-normal">(2 Small = 1 Big)</span>
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="0"
                value={smallBoxes}
                onChange={(e) => setSmallBoxes(e.target.value)}
                className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Rate and Amount Paid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Selling Rate per Big Box (₹)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                step="any"
                placeholder="e.g. 1100"
                value={ratePerBigBox}
                onChange={(e) => setRatePerBigBox(e.target.value)}
                required
                className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none text-red-700"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-700">Amount Paid (₹)</label>
                <span className="text-[11px] text-slate-500 font-medium">(0 allowed)</span>
              </div>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none text-emerald-700"
              />
            </div>
          </div>

          {/* Quick Pay Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePayFull}
              className="h-8 px-3 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
            >
              Pay Full Due ({formatCurrency(totalDue > 0 ? totalDue : 0)})
            </button>
            <button
              type="button"
              onClick={handlePayTodayBill}
              className="h-8 px-3 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all cursor-pointer shadow-2xs"
            >
              Pay Today's Bill ({formatCurrency(todayBill)})
            </button>
            <button
              type="button"
              onClick={handlePayZero}
              className="h-8 px-3 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer shadow-2xs"
            >
              Pay ₹0 (Credit)
            </button>
          </div>

          {/* AUTOMATIC LIVE TALLY PREVIEW */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-200">
              <Sparkles className="w-4 h-4 text-red-500" />
              <span>Automatic Tally Calculation</span>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-600 font-medium py-0.5">
              <span>Today's Box Equivalent:</span>
              <span className="font-bold text-slate-900 font-mono">
                {bigEquivalent} Big Eqv {bigNum > 0 && smallNum > 0 ? `(${bigNum}B + ${smallNum}S)` : ''}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-600 font-medium py-0.5">
              <span>Today's Bill:</span>
              <span className="font-black text-slate-900 text-sm font-mono">{formatCurrency(todayBill)}</span>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-600 font-medium py-0.5">
              <span>Old Balance:</span>
              <span className="font-bold text-slate-800 font-mono">{oldBalDisplay.text}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-800">Total Due:</span>
              <span className="text-lg font-black text-slate-900 font-mono">{formatCurrency(totalDue)}</span>
            </div>

            <div className="flex justify-between items-baseline text-xs text-slate-600 py-0.5">
              <span>Amount Paid:</span>
              <span className="font-black text-emerald-700 text-sm font-mono">{formatCurrency(paidNum)}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
              <span className="text-sm font-extrabold text-slate-900">New Balance:</span>
              <span className={`text-xl font-black px-2.5 py-0.5 rounded-lg border font-mono ${newBalDisplay.color}`}>
                {newBalDisplay.text}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Optional Notes</label>
            <input
              type="text"
              placeholder="e.g. Afternoon delivery, direct pickup"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
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
              className="h-11 px-6 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Generating Bill...' : 'Save & Generate Bill'}
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
