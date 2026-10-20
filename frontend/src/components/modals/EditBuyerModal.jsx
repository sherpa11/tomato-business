import React, { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle } from 'lucide-react';
import { buyersAPI } from '../../api/client';

export default function EditBuyerModal({ isOpen, onClose, buyerId, initialBuyer = null, onSuccess }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setError('');
    if (initialBuyer) {
      setName(initialBuyer.name || '');
      setPhone(initialBuyer.phone || '');
      setAddress(initialBuyer.address || '');
      setNotes(initialBuyer.notes || '');
      setInitialBalance(initialBuyer.initialBalance !== undefined ? String(initialBuyer.initialBalance) : '0');
      setActive(initialBuyer.active !== undefined ? initialBuyer.active : true);
    } else if (buyerId) {
      setLoading(true);
      buyersAPI.getBuyerById(buyerId)
        .then((res) => {
          if (res.success && res.buyer) {
            const b = res.buyer;
            setName(b.name || '');
            setPhone(b.phone || '');
            setAddress(b.address || '');
            setNotes(b.notes || '');
            setInitialBalance(b.initialBalance !== undefined ? String(b.initialBalance) : '0');
            setActive(b.active !== undefined ? b.active : true);
          }
        })
        .catch((err) => {
          setError(err.message || 'Failed to fetch customer profile');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, buyerId, initialBuyer]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const targetId = buyerId || initialBuyer?._id;
    if (!targetId) {
      setError('Customer identifier missing');
      return;
    }
    if (!name.trim()) {
      setError('Customer / Buyer name is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await buyersAPI.updateBuyer(targetId, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim(),
        initialBalance: Number(initialBalance) || 0,
        active: Boolean(active)
      });

      if (res.success) {
        if (onSuccess) onSuccess(res.buyer);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update customer profile');
    } finally {
      setSubmitting(false);
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
            <div className="w-10 h-10 bg-amber-50 text-amber-800 rounded-xl flex items-center justify-center border border-amber-200/70 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Edit Customer Profile</h3>
              <p className="text-xs text-slate-500 font-medium">Update contact, mandi stall & ledger settings</p>
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

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm font-medium">
            Loading customer profile...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Customer Name / Stall ID *
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar, Stall #4"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-11 text-sm font-semibold border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone Number (Optional)</label>
              <input
                type="tel"
                inputMode="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Address / Stall Info (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Gate 2, Retail Line, Stall 14"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Profile Notes / Details (Optional)</label>
              <textarea
                rows="2"
                placeholder="e.g. Weekly settlement, preferred box sizes, contact person"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Opening / Initial Balance (₹)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="0"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full h-11 text-sm font-black border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
              />
              <span className="text-[11px] text-slate-500 block mt-1.5">
                Updating opening balance recalculates the customer's chronological tally ledger.
              </span>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="editBuyerActiveModal"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded-md text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="editBuyerActiveModal" className="text-xs font-bold text-slate-700 cursor-pointer">
                Active Customer (Uncheck to hide from daily billing dropdowns)
              </label>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-10 px-5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
