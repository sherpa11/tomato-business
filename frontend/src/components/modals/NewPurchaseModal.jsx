import React, { useState, useEffect } from 'react';
import { X, Truck, AlertCircle, Plus, Trash2 } from 'lucide-react';
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
  const [rows, setRows] = useState([
    {
      id: 1,
      bigBoxes: '',
      smallBoxes: '',
      ratePerBigBox: settings.defaultPurchaseRate?.toString() || '1000'
    }
  ]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load suppliers and set defaults
  useEffect(() => {
    if (isOpen) {
      setTransactionDate(operationalDate);
      setError('');
      setRows([
        {
          id: 1,
          bigBoxes: '',
          smallBoxes: '',
          ratePerBigBox: settings.defaultPurchaseRate?.toString() || '1000'
        }
      ]);
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

  // Multi-row management
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        bigBoxes: '',
        smallBoxes: '',
        ratePerBigBox: prev[prev.length - 1]?.ratePerBigBox || settings.defaultPurchaseRate?.toString() || '1000'
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
  let totalPurchaseAmount = 0;

  const rowCalculations = rows.map((r) => {
    const b = Number(r.bigBoxes) || 0;
    const s = Number(r.smallBoxes) || 0;
    const eq = calculateBigEquivalent(b, s);
    const rt = Number(r.ratePerBigBox) || 0;
    const amt = Math.round((eq * rt + Number.EPSILON) * 100) / 100;

    totalBigBoxes += b;
    totalSmallBoxes += s;
    totalBigEquivalent += eq;
    totalPurchaseAmount += amt;

    return { b, s, eq, rt, amt };
  });

  totalBigEquivalent = Math.round((totalBigEquivalent + Number.EPSILON) * 10) / 10;
  totalPurchaseAmount = Math.round((totalPurchaseAmount + Number.EPSILON) * 100) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!supplierId) {
      setError('Please select a supplier');
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
        setError(`Row ${i + 1}: Purchase rate must be greater than zero`);
        return;
      }
      totalBoxesCount += (b + s);
    }

    if (totalBoxesCount === 0) {
      setError('A purchase requires at least one Big or Small box');
      return;
    }

    setLoading(true);
    try {
      const itemsPayload = rows.map((r) => {
        const b = Number(r.bigBoxes) || 0;
        const s = Number(r.smallBoxes) || 0;
        const eq = calculateBigEquivalent(b, s);
        const rt = Number(r.ratePerBigBox) || 0;
        const amt = Math.round((eq * rt + Number.EPSILON) * 100) / 100;
        return {
          bigBoxes: b,
          smallBoxes: s,
          bigEquivalent: eq,
          ratePerBigBox: rt,
          lineAmount: amt,
          totalAmount: amt
        };
      });

      const res = await purchasesAPI.createPurchase({
        supplierId,
        transactionDate,
        bigBoxes: totalBigBoxes,
        smallBoxes: totalSmallBoxes,
        ratePerBigBox: rows[0]?.ratePerBigBox ? Number(rows[0].ratePerBigBox) : 0,
        notes,
        items: itemsPayload
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

          {/* Tomato Crates & Rate Section with + Add Row */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                Tomato Crates & Rate
                {rows.length > 1 && (
                  <span className="ml-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {rows.length} rows
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="Add another crate & rate row for this supplier"
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
                          Lot / Row #{index + 1}
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
                          className="w-full h-11 text-base font-bold font-mono border border-slate-300 rounded-xl px-3 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                          className="w-full h-11 text-base font-bold font-mono border border-slate-300 rounded-xl px-3 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Purchase Rate per Big Box (₹)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="1"
                          step="any"
                          placeholder="e.g. 1000"
                          value={row.ratePerBigBox}
                          onChange={(e) => handleRowChange(index, 'ratePerBigBox', e.target.value)}
                          className="w-full h-11 text-base font-black font-mono border border-slate-300 rounded-xl px-3.5 bg-white text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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

          {/* Automatic Calculation Preview Card */}
          <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-4 space-y-2 shadow-2xs">
            <div className="flex justify-between items-center text-xs text-emerald-900 font-semibold py-0.5">
              <span>Total Big Box Equivalent:</span>
              <span className="font-extrabold font-mono text-sm">{totalBigEquivalent} Big Eqv</span>
            </div>
            {rows.length > 1 && (
              <div className="flex justify-between items-center text-xs text-emerald-900 font-semibold py-0.5">
                <span>Total Crates Count:</span>
                <span className="font-mono">{totalBigBoxes} Big + {totalSmallBoxes} Small</span>
              </div>
            )}
            {rows.length === 1 && (
              <div className="flex justify-between items-center text-xs text-emerald-900 font-semibold py-0.5">
                <span>Rate per Big Box:</span>
                <span className="font-mono">{formatCurrency(rowCalculations[0]?.rt || 0)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-emerald-200/80 flex justify-between items-baseline">
              <span className="text-sm font-bold text-emerald-950">Grand Total Purchase:</span>
              <span className="text-2xl font-black font-mono text-emerald-700">
                {formatCurrency(totalPurchaseAmount)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Optional Notes</label>
            <input
              type="text"
              placeholder="e.g. Truck RJ-14-1234, Morning lot, High quality"
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
