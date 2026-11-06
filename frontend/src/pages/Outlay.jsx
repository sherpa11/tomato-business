import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  Check,
  X
} from 'lucide-react';
import { outlayAPI } from '../api/client';
import { useDate } from '../context/DateContext';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function Outlay() {
  const { operationalDate } = useDate();

  // Active date for outlays: defaults to operational date
  const [selectedDate, setSelectedDate] = useState(operationalDate);
  const [outlays, setOutlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Entry Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const descInputRef = useRef(null);

  // Sync when operationalDate changes initially
  useEffect(() => {
    if (operationalDate) {
      setSelectedDate(operationalDate);
    }
  }, [operationalDate]);

  // Fetch outlays for the selected date
  const fetchDateOutlays = useCallback(async (targetDate) => {
    if (!targetDate) return;
    try {
      setLoading(true);
      setError('');
      const res = await outlayAPI.getOutlays({ date: targetDate });
      if (res?.success) {
        setOutlays(res.outlays || []);
      }
    } catch (err) {
      console.error('Failed to fetch outlays:', err);
      setError(err?.response?.data?.message || 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDateOutlays(selectedDate);
  }, [selectedDate, fetchDateOutlays]);

  // Calculate sum of active outlays
  const totalOutlay = outlays.reduce((sum, item) => {
    if (!item.isVoid) {
      return sum + (Number(item.amount) || 0);
    }
    return sum;
  }, 0);

  // Handle Form Submission (Add or Edit)
  const handleSaveOutlay = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setFormError('Please enter what the expense was for.');
      return;
    }

    const numAmt = Number(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setFormError('Please enter a valid amount greater than ₹0.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        // Update existing outlay
        await outlayAPI.updateOutlay(editingId, {
          transactionDate: selectedDate,
          description: trimmedDesc,
          notes: trimmedDesc,
          amount: numAmt
        });
        setEditingId(null);
      } else {
        // Create new outlay
        await outlayAPI.createOutlay({
          transactionDate: selectedDate,
          description: trimmedDesc,
          notes: trimmedDesc,
          recipient: trimmedDesc,
          amount: numAmt
        });
      }

      // Reset form fields
      setDescription('');
      setAmount('');
      if (descInputRef.current) descInputRef.current.focus();

      // Refresh list
      fetchDateOutlays(selectedDate);
    } catch (err) {
      console.error('Failed to save outlay:', err);
      setFormError(err?.response?.data?.message || err?.message || 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  // Start editing an entry
  const handleEditClick = (item) => {
    setEditingId(item._id);
    setDescription(item.description || item.notes || item.recipient || '');
    setAmount(String(item.amount || ''));
    setFormError('');
    if (descInputRef.current) {
      descInputRef.current.focus();
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setFormError('');
  };

  // Confirm delete/void
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await outlayAPI.deleteOutlay(deleteTarget._id);
      setDeleteTarget(null);
      fetchDateOutlays(selectedDate);
    } catch (err) {
      console.error('Failed to delete outlay:', err);
      alert(err?.response?.data?.message || 'Failed to delete outlay entry.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Outlay / செலவுகள்
            </h1>
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Admin only
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Simple daily expense register — Record vehicle rent, salaries, supplier payments & shop costs
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shrink-0">
          <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="text-xs font-bold text-slate-700">Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              if (editingId) handleCancelEdit();
            }}
            className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer font-mono"
          />
        </div>
      </div>

      {/* Outlay Entry Form */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-slate-900">
            {editingId ? 'Edit Outlay' : 'Add Outlay'}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Edit</span>
            </button>
          )}
        </div>

        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSaveOutlay} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              What was the expense for? <span className="text-red-500">*</span>
            </label>
            <input
              ref={descInputRef}
              type="text"
              required
              placeholder="e.g. Vehicle rent, Salary, Supplier payment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-11 text-base font-bold font-mono border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400 text-emerald-800"
            />
          </div>

          <div className="pt-1 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : editingId ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Update Outlay</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>+ Save Outlay</span>
                </>
              )}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="h-11 px-5 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Date-wise Expense List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-900">
              {selectedDate === operationalDate ? "Today's Outlays" : `Outlays for ${formatDate(selectedDate)}`}
            </h2>
            <span className="text-[11px] font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
              {outlays.length}
            </span>
          </div>

          <button
            onClick={() => fetchDateOutlays(selectedDate)}
            disabled={loading}
            title="Refresh list"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 text-xs font-semibold border-b border-red-100 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-xs font-bold text-slate-500">Loading expenses...</p>
          </div>
        ) : outlays.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <p className="text-sm font-bold text-slate-600">No expenses recorded for this date.</p>
            <p className="text-xs text-slate-400 mt-1">Use the form above to add an outlay.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-16 text-center">S.No.</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {outlays.map((item, index) => {
                  const displayDesc =
                    item.description || item.notes || item.recipient || item.category || 'Expense';

                  return (
                    <tr
                      key={item._id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        editingId === item._id ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400 text-center text-xs">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {displayDesc}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black font-mono text-slate-900">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditClick(item)}
                            title="Edit Outlay"
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            title="Delete Outlay"
                            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50/90 border-t-2 border-slate-200">
                  <td colSpan={2} className="py-4 px-4 font-black text-sm text-slate-900 uppercase tracking-wide">
                    TOTAL OUTLAY
                  </td>
                  <td className="py-4 px-4 text-right font-black font-mono text-lg text-emerald-700">
                    {formatCurrency(totalOutlay)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Simple Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-100 overflow-hidden p-6 space-y-4">
            <h3 className="text-base font-black text-slate-900">Delete Outlay Entry</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete this expense of{' '}
              <strong className="text-slate-900 font-mono">
                {formatCurrency(deleteTarget.amount)}
              </strong>{' '}
              for "
              <strong className="text-slate-900">
                {deleteTarget.description || deleteTarget.notes || deleteTarget.recipient || 'Expense'}
              </strong>
              "?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="h-9 px-4 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
