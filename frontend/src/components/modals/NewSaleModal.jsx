import React, { useState, useEffect } from 'react';
import { X, Receipt, AlertCircle, Sparkles, Plus, Trash2 } from 'lucide-react';
import { buyersAPI, transactionsAPI } from '../../api/client';
import { useDate } from '../../context/DateContext';
import { useSettings } from '../../context/SettingsContext';
import {
  calculateBigEquivalent,
  formatCurrency,
  formatBalance
} from '../../utils/formatters';
import EditBuyerModal from './EditBuyerModal';
import SearchableBuyerSelect from '../common/SearchableBuyerSelect';

export default function NewSaleModal({ isOpen, onClose, onSuccess, initialBuyerId = null }) {
  const { operationalDate } = useDate();
  const { settings } = useSettings();

  const [buyers, setBuyers] = useState([]);
  const [buyerId, setBuyerId] = useState(initialBuyerId || '');
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [transactionDate, setTransactionDate] = useState(operationalDate);
  const [amountPaid, setAmountPaid] = useState('');
  const [oldBalanceInput, setOldBalanceInput] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingBuyer, setFetchingBuyer] = useState(false);
  const [error, setError] = useState('');

  // Tomato Crates & Rate multi-row state (allowing multiple rows with different rates for the same buyer)
  const [rows, setRows] = useState([
    {
      id: 1,
      bigBoxes: '',
      smallBoxes: '',
      ratePerBigBox: ''
    }
  ]);

  // Fetch active buyers on modal open
  useEffect(() => {
    if (!isOpen) return;

    const defaultRate = settings.defaultSellingRate?.toString() || '1100';
    setTransactionDate(operationalDate);
    setError('');
    setAmountPaid('');
    setOldBalanceInput('');
    setNotes('');
    setRows([
      {
        id: 1,
        bigBoxes: '',
        smallBoxes: '',
        ratePerBigBox: defaultRate
      }
    ]);

    buyersAPI.getBuyers({ active: true, dropdown: true })
      .then((res) => {
        if (res.success && res.buyers) {
          setBuyers(res.buyers);
          const targetId = initialBuyerId || (res.buyers.length > 0 ? res.buyers[0]._id : '');
          const target = res.buyers.find((b) => String(b._id) === String(targetId));
          if (target) {
            setSelectedBuyer(target);
            setOldBalanceInput(target.currentBalance !== undefined ? String(target.currentBalance) : '0');
          }
          setBuyerId(targetId);
        }
      })
      .catch((err) => console.error('Error fetching buyers:', err));
  }, [isOpen, operationalDate, settings, initialBuyerId]);

  // Fetch full buyer info & live ledger balance when buyerId changes (reuse loaded buyer if available)
  useEffect(() => {
    if (!isOpen) return;

    if (buyerId) {
      if (selectedBuyer && String(selectedBuyer._id) === String(buyerId)) {
        return;
      }
      const existing = buyers.find((b) => String(b._id) === String(buyerId));
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
  }, [isOpen, buyerId, buyers, selectedBuyer]);

  if (!isOpen) return null;

  // Multi-row management
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        bigBoxes: '',
        smallBoxes: '',
        ratePerBigBox: prev[prev.length - 1]?.ratePerBigBox || settings.defaultSellingRate?.toString() || '1100'
      }
    ]);
  };

  const handleRemoveRow = (index) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Live Calculations across all crate rows
  let totalBigBoxes = 0;
  let totalSmallBoxes = 0;
  let totalBigEquivalent = 0;
  let todayBill = 0;

  const rowCalculations = rows.map((r) => {
    const b = Number(r.bigBoxes) || 0;
    const s = Number(r.smallBoxes) || 0;
    const eq = calculateBigEquivalent(b, s);
    const rt = Number(r.ratePerBigBox) || 0;
    const amt = Math.round((eq * rt + Number.EPSILON) * 100) / 100;

    totalBigBoxes += b;
    totalSmallBoxes += s;
    totalBigEquivalent += eq;
    todayBill += amt;

    return { b, s, eq, rt, amt };
  });

  totalBigEquivalent = Math.round((totalBigEquivalent + Number.EPSILON) * 10) / 10;
  todayBill = Math.round((todayBill + Number.EPSILON) * 100) / 100;

  const oldBalance = oldBalanceInput !== '' ? Number(oldBalanceInput) || 0 : Number(selectedBuyer?.currentBalance || 0);
  const totalDue = Math.round((oldBalance + todayBill + Number.EPSILON) * 100) / 100;
  const paidNum = Number(amountPaid) || 0;
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

    // Validate rows
    let totalBoxesCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const b = Number(r.bigBoxes) || 0;
      const s = Number(r.smallBoxes) || 0;
      const rate = Number(r.ratePerBigBox) || 0;

      if (b < 0 || s < 0) {
        setError(`Row ${i + 1}: Box quantities cannot be negative`);
        return;
      }
      if (b === 0 && s === 0) {
        setError(`Row ${i + 1}: Please enter at least one Big or Small box`);
        return;
      }
      if (rate <= 0 || isNaN(rate)) {
        setError(`Row ${i + 1}: Selling rate must be greater than zero`);
        return;
      }
      totalBoxesCount += (b + s);
    }

    if (totalBoxesCount === 0) {
      setError('A sale requires at least one Big or Small box');
      return;
    }
    if (paidNum < 0) {
      setError('Amount paid cannot be negative');
      return;
    }

    setLoading(true);
    try {
      const itemsPayload = rows.map((r) => {
        const b = Number(r.bigBoxes) || 0;
        const s = Number(r.smallBoxes) || 0;
        const eq = calculateBigEquivalent(b, s);
        const rt = Number(r.ratePerBigBox) || 0;
        return {
          bigBoxes: b,
          smallBoxes: s,
          bigEquivalent: eq,
          ratePerBigBox: rt,
          lineAmount: Math.round((eq * rt + Number.EPSILON) * 100) / 100,
          billAmount: Math.round((eq * rt + Number.EPSILON) * 100) / 100
        };
      });

      const res = await transactionsAPI.createSale({
        buyerId,
        transactionDate,
        items: itemsPayload,
        bigBoxes: totalBigBoxes,
        smallBoxes: totalSmallBoxes,
        ratePerBigBox: rows.length === 1 ? (Number(rows[0].ratePerBigBox) || 0) : (totalBigEquivalent > 0 ? Math.round((todayBill / totalBigEquivalent) * 100) / 100 : 0),
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
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-3.5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-100 shrink-0">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Create Buyer Bill & Tally</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Automatic box conversion & balance tally</p>
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

        <form onSubmit={handleSubmit} className="mt-4 sm:mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
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
              <SearchableBuyerSelect
                buyers={buyers}
                value={buyerId}
                onChange={(id, b) => {
                  setBuyerId(id);
                  setSelectedBuyer(b);
                  if (b?.currentBalance !== undefined) {
                    setOldBalanceInput(String(b.currentBalance));
                  }
                }}
                placeholder="Select or search buyer..."
                required
              />
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

          {/* TOMATO CRATES & RATE Multi-Row Section */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span>TOMATO CRATES & RATE</span>
                {rows.length > 1 && (
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                    {rows.length} rows
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="Add another crate & rate row for this customer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-700" />
                <span>+ Add Row</span>
              </button>
            </div>

            {/* Crate & Rate Rows */}
            <div className="space-y-3">
              {rows.map((row, index) => {
                const calc = rowCalculations[index];

                return (
                  <div
                    key={row.id}
                    className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3 sm:p-4 space-y-3 relative group"
                  >
                    {rows.length > 1 && (
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                        <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wide">
                          Item #{index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                          title="Remove this row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Big Boxes <span className="text-slate-400 font-normal text-[10px] sm:text-xs">(1 Big = 1)</span>
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={row.bigBoxes}
                          onChange={(e) => handleRowChange(index, 'bigBoxes', e.target.value)}
                          className="w-full h-11 text-base font-bold font-mono border border-slate-300 rounded-xl px-3 bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Small Boxes <span className="text-slate-400 font-normal text-[10px] sm:text-xs">(2 Small = 1 Big)</span>
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={row.smallBoxes}
                          onChange={(e) => handleRowChange(index, 'smallBoxes', e.target.value)}
                          className="w-full h-11 text-base font-bold font-mono border border-slate-300 rounded-xl px-3 bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Selling Rate per Big Box (₹)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="1"
                          step="any"
                          placeholder="e.g. 650"
                          value={row.ratePerBigBox}
                          onChange={(e) => handleRowChange(index, 'ratePerBigBox', e.target.value)}
                          className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl px-3.5 bg-white text-red-600 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 flex items-center justify-around text-xs shadow-2xs h-11">
                        <div className="text-center min-w-0">
                          <span className="text-slate-400 text-[10px] block font-medium">Row Eqv</span>
                          <span className="font-bold text-slate-800 font-mono text-xs sm:text-sm truncate block">
                            {calc.eq} Big
                          </span>
                        </div>
                        <div className="w-px h-6 bg-slate-200" />
                        <div className="text-center min-w-0">
                          <span className="text-slate-400 text-[10px] block font-medium">Amount</span>
                          <span className="font-black text-slate-900 font-mono text-xs sm:text-sm truncate block">
                            {formatCurrency(calc.amt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Amount Paid input */}
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
                {totalBigEquivalent} Big Eqv {totalBigBoxes > 0 || totalSmallBoxes > 0 ? `(${totalBigBoxes}B + ${totalSmallBoxes}S)` : ''}
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
