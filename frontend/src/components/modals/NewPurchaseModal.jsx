import React, { useState, useEffect } from 'react';
import { X, Truck, AlertCircle } from 'lucide-react';
import { suppliersAPI, purchasesAPI } from '../../api/client';
import { useDate } from '../../context/DateContext';
import { useSettings } from '../../context/SettingsContext';
import { calculateBigEquivalent, formatCurrency } from '../../utils/formatters';

export default function NewPurchaseModal({ isOpen, onClose, onSuccess, initialSupplierId = null }) {
  const { operationalDate } = useDate();
  const { settings } = useSettings();

  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState(initialSupplierId || '');
  const [transactionDate, setTransactionDate] = useState(operationalDate);
  const [bigBoxes, setBigBoxes] = useState('');
  const [smallBoxes, setSmallBoxes] = useState('');
  const [ratePerBigBox, setRatePerBigBox] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load suppliers and set defaults
  useEffect(() => {
    if (isOpen) {
      setTransactionDate(operationalDate);
      setRatePerBigBox(settings.defaultPurchaseRate?.toString() || '1000');
      setError('');
      setBigBoxes('');
      setSmallBoxes('');
      setNotes('');

      suppliersAPI.getSuppliers({ active: true })
        .then((res) => {
          if (res.success && res.suppliers) {
            setSuppliers(res.suppliers);
            if (!supplierId && res.suppliers.length > 0) {
              setSupplierId(initialSupplierId || res.suppliers[0]._id);
            }
          }
        })
        .catch((err) => console.error('Error fetching suppliers:', err));
    }
  }, [isOpen, operationalDate, settings, initialSupplierId]);

  if (!isOpen) return null;

  // Live Calculations
  const bigNum = Number(bigBoxes) || 0;
  const smallNum = Number(smallBoxes) || 0;
  const rateNum = Number(ratePerBigBox) || 0;
  const bigEquivalent = calculateBigEquivalent(bigNum, smallNum);
  const totalAmount = Math.round((bigEquivalent * rateNum + Number.EPSILON) * 100) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!supplierId) {
      setError('Please select a supplier');
      return;
    }
    if (bigNum === 0 && smallNum === 0) {
      setError('Please enter at least one Big or Small box');
      return;
    }
    if (rateNum <= 0) {
      setError('Purchase rate must be greater than zero');
      return;
    }

    setLoading(true);
    try {
      const res = await purchasesAPI.createPurchase({
        supplierId,
        transactionDate,
        bigBoxes: bigNum,
        smallBoxes: smallNum,
        ratePerBigBox: rateNum,
        notes
      });

      if (res.success) {
        onSuccess(res.purchase);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to record purchase');
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
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3" />

        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center border border-emerald-100 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Record Supplier Purchase</h3>
              <p className="text-xs text-slate-500 font-medium">Daily incoming tomato lot</p>
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
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                className="w-full h-11 text-sm font-semibold border border-slate-300 rounded-xl px-3 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Purchase Date</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
                className="w-full h-11 text-sm font-bold border border-slate-300 rounded-xl px-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

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
                className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Purchase Rate per Big Box (₹)
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="any"
              placeholder="e.g. 1000"
              value={ratePerBigBox}
              onChange={(e) => setRatePerBigBox(e.target.value)}
              required
              className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-emerald-800"
            />
          </div>

          {/* Automatic Calculation Preview Card */}
          <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-4 space-y-2 shadow-2xs">
            <div className="flex justify-between items-center text-xs text-emerald-900 font-semibold py-0.5">
              <span>Big Box Equivalent:</span>
              <span className="font-extrabold font-mono text-sm">{bigEquivalent} Big Eqv</span>
            </div>
            <div className="flex justify-between items-center text-xs text-emerald-900 font-semibold py-0.5">
              <span>Rate per Big Box:</span>
              <span className="font-mono">{formatCurrency(rateNum)}</span>
            </div>
            <div className="pt-2 border-t border-emerald-200/80 flex justify-between items-baseline">
              <span className="text-sm font-bold text-emerald-950">Total Purchase:</span>
              <span className="text-2xl font-black font-mono text-emerald-700">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Notes / Truck # (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Truck RJ-14-1234, Morning lot"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
              className="h-11 px-6 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Save Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
