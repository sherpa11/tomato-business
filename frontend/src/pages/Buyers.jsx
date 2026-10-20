import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Receipt,
  CreditCard,
  Eye,
  Phone,
  AlertCircle,
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import { buyersAPI } from '../api/client';
import NewSaleModal from '../components/modals/NewSaleModal';
import NewPaymentModal from '../components/modals/NewPaymentModal';
import EditBuyerModal from '../components/modals/EditBuyerModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import { formatCurrency, formatBalance, formatDate } from '../utils/formatters';

export default function Buyers() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Add buyer modal state
  const [addBuyerModalOpen, setAddBuyerModalOpen] = useState(false);
  const [newBuyerName, setNewBuyerName] = useState('');
  const [newBuyerPhone, setNewBuyerPhone] = useState('');
  const [newBuyerAddress, setNewBuyerAddress] = useState('');
  const [newBuyerInitialBal, setNewBuyerInitialBal] = useState('');
  const [submittingBuyer, setSubmittingBuyer] = useState(false);
  const [addBuyerError, setAddBuyerError] = useState('');

  // Edit buyer modal state
  const [editBuyerModalOpen, setEditBuyerModalOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState(null);

  // Delete buyer state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [buyerToDelete, setBuyerToDelete] = useState(null);
  const [deletingBuyer, setDeletingBuyer] = useState(false);

  // Quick action modals
  const [activeBuyerId, setActiveBuyerId] = useState(null);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);


  const fetchBuyers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await buyersAPI.getBuyers({ search });
      if (res.success) {
        setBuyers(res.buyers);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch buyers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchBuyers();
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [fetchBuyers]);

  const handleCreateBuyer = async (e) => {
    e.preventDefault();
    setAddBuyerError('');
    if (!newBuyerName.trim()) {
      setAddBuyerError('Buyer name is required');
      return;
    }

    setSubmittingBuyer(true);
    try {
      const res = await buyersAPI.createBuyer({
        name: newBuyerName.trim(),
        phone: newBuyerPhone.trim(),
        address: newBuyerAddress.trim(),
        initialBalance: Number(newBuyerInitialBal) || 0
      });

      if (res.success) {
        setAddBuyerModalOpen(false);
        setNewBuyerName('');
        setNewBuyerPhone('');
        setNewBuyerAddress('');
        setNewBuyerInitialBal('');
        fetchBuyers();
      }
    } catch (err) {
      setAddBuyerError(err.message || 'Failed to create buyer');
    } finally {
      setSubmittingBuyer(false);
    }
  };

  const handleOpenEditBuyer = (b) => {
    setEditingBuyer(b);
    setEditBuyerModalOpen(true);
  };

  const handleOpenSale = (buyerId) => {
    setActiveBuyerId(buyerId);
    setSaleModalOpen(true);
  };

  const handleOpenPayment = (buyerId) => {
    setActiveBuyerId(buyerId);
    setPaymentModalOpen(true);
  };

  const promptDeleteBuyer = (b) => {
    setBuyerToDelete(b);
    setDeleteModalOpen(true);
  };

  const executeDeleteBuyer = async () => {
    if (!buyerToDelete) return;
    setDeletingBuyer(true);
    try {
      const res = await buyersAPI.deleteBuyer(buyerToDelete._id);
      if (res.success) {
        setDeleteModalOpen(false);
        setBuyerToDelete(null);
        fetchBuyers();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete buyer');
    } finally {
      setDeletingBuyer(false);
    }
  };


  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-100 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Buyers & Customer Tally</h1>
            <p className="text-xs text-slate-500 font-medium">Manage buyer accounts, current dues, and tallies</p>
          </div>
        </div>

        <button
          onClick={() => setAddBuyerModalOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-11 px-5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Add New Buyer</span>
        </button>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search buyer by name, phone, or stall..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-2xs"
          />
        </div>
        <div className="h-11 px-4 flex items-center justify-center bg-white border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-500 shadow-2xs">
          <span>Total Buyers: <strong className="text-slate-900 font-extrabold ml-1">{buyers.length}</strong></span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* MOBILE BUYERS CARDS (< 640px) */}
      <div className="sm:hidden space-y-3">
        {buyers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
            No buyers found. Click "+ Add New Buyer" above.
          </div>
        ) : (
          buyers.map((b) => {
            const bal = formatBalance(b.currentBalance);
            return (
              <div key={b._id} className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <Link
                      to={`/buyers/${b._id}`}
                      className="font-extrabold text-slate-900 text-base hover:text-red-600 block leading-tight"
                    >
                      {b.name}
                    </Link>
                    {b.address && (
                      <span className="text-xs text-slate-500 block font-normal mt-0.5">{b.address}</span>
                    )}
                  </div>
                  <span className={`inline-block font-black font-mono text-sm px-2.5 py-0.5 rounded-lg border ${bal.color}`}>
                    {bal.text}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  {b.phone ? (
                    <a
                      href={`tel:${b.phone}`}
                      className="inline-flex items-center gap-1.5 font-mono text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg font-bold"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{b.phone}</span>
                    </a>
                  ) : (
                    <span className="text-slate-400">No phone</span>
                  )}
                  <span className="text-slate-500 font-mono text-[11px]">
                    Last: {formatDate(b.lastTransactionDate)}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1 pt-1">
                  <button
                    onClick={() => handleOpenSale(b._id)}
                    className="h-10 rounded-xl flex items-center justify-center gap-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 active:scale-95 transition-transform"
                    title="Bill"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Bill</span>
                  </button>

                  <button
                    onClick={() => handleOpenPayment(b._id)}
                    className="h-10 rounded-xl flex items-center justify-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 active:scale-95 transition-transform"
                    title="Pay"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Pay</span>
                  </button>

                  <Link
                    to={`/buyers/${b._id}`}
                    className="h-10 rounded-xl flex items-center justify-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 active:scale-95 transition-transform"
                    title="Ledger"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Ledger</span>
                  </Link>

                  <button
                    onClick={() => handleOpenEditBuyer(b)}
                    className="h-10 rounded-xl flex items-center justify-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 active:scale-95 transition-transform"
                    title="Edit Customer Details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Edit</span>
                  </button>

                  <button
                    onClick={() => promptDeleteBuyer(b)}
                    className="h-10 rounded-xl flex items-center justify-center gap-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 active:scale-95 transition-transform"
                    title="Delete Customer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Delete</span>
                  </button>
                </div>

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
                <th className="py-3 px-4 text-left sticky left-0 bg-slate-50/95 z-10 shadow-2xs">Buyer Name</th>
                <th className="py-3 px-4 text-left">Phone</th>
                <th className="py-3 px-4 text-right">Current Balance</th>
                <th className="py-3 px-4 text-right">Total Purchases</th>
                <th className="py-3 px-4 text-right">Total Payments</th>
                <th className="py-3 px-4 text-center">Last Active</th>
                <th className="no-print py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {buyers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    No buyers found. Click "+ Add New Buyer" to register a customer.
                  </td>
                </tr>
              ) : (
                buyers.map((b) => {
                  const bal = formatBalance(b.currentBalance);
                  return (
                    <tr key={b._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-left font-bold text-slate-900 sticky left-0 bg-white z-10 shadow-2xs">
                        <Link
                          to={`/buyers/${b._id}`}
                          className="hover:text-red-600 hover:underline inline-flex items-center gap-1.5"
                        >
                          {b.name}
                        </Link>
                        {b.address && (
                          <span className="text-xs text-slate-400 block font-normal mt-0.5">{b.address}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-left text-xs font-mono text-slate-600">
                        {b.phone ? (
                          <a
                            href={`tel:${b.phone}`}
                            className="inline-flex items-center gap-1.5 hover:text-emerald-700"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {b.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-block font-black font-mono text-sm px-2.5 py-0.5 rounded-lg border ${bal.color}`}
                        >
                          {bal.text}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-800">
                        {formatCurrency(b.totalPurchases)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-medium text-emerald-700">
                        {formatCurrency(b.totalPayments)}
                      </td>

                      <td className="py-3.5 px-4 text-center text-xs text-slate-500 font-mono">
                        {formatDate(b.lastTransactionDate)}
                      </td>

                      <td className="no-print py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            to={`/buyers/${b._id}`}
                            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/60 rounded-lg transition-all shadow-2xs"
                            title="View Account Ledger"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ledger</span>
                          </Link>

                          <button
                            onClick={() => handleOpenSale(b._id)}
                            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                            title="Create Bill"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Bill</span>
                          </button>

                          <button
                            onClick={() => handleOpenPayment(b._id)}
                            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                            title="Record Payment"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay</span>
                          </button>

                          <button
                            onClick={() => handleOpenEditBuyer(b)}
                            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                            title="Edit Customer Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => promptDeleteBuyer(b)}
                            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>

                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Buyer Modal */}
      {/* Add Buyer Modal (Bottom Sheet on Mobile) */}
      {addBuyerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddBuyerModalOpen(false);
          }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Mobile Sheet Handle */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Add New Buyer</h3>
              <button
                onClick={() => setAddBuyerModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addBuyerError && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addBuyerError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBuyer} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Buyer Name / Stall ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. B1, Ramesh Kumar, Stall #4"
                  value={newBuyerName}
                  onChange={(e) => setNewBuyerName(e.target.value)}
                  required
                  className="w-full h-11 text-sm font-semibold border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone Number (Optional)</label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="e.g. 9876543210"
                  value={newBuyerPhone}
                  onChange={(e) => setNewBuyerPhone(e.target.value)}
                  className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Address / Stall Info (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Gate 2, Retail Line"
                  value={newBuyerAddress}
                  onChange={(e) => setNewBuyerAddress(e.target.value)}
                  className="w-full h-11 text-sm border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none"
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
                  placeholder="0 (e.g. 2500 if previous debt)"
                  value={newBuyerInitialBal}
                  onChange={(e) => setNewBuyerInitialBal(e.target.value)}
                  className="w-full h-11 text-sm font-bold border border-slate-300 rounded-xl px-3.5 focus:ring-2 focus:ring-red-500 focus:outline-none font-mono"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  Enter positive number for old debt, negative for advance credit.
                </span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddBuyerModalOpen(false)}
                  className="h-11 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBuyer}
                  className="h-11 px-5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {submittingBuyer ? 'Saving...' : 'Create Buyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Profile Modal */}
      <EditBuyerModal
        isOpen={editBuyerModalOpen}
        onClose={() => setEditBuyerModalOpen(false)}
        initialBuyer={editingBuyer}
        onSuccess={() => fetchBuyers()}
      />

      {/* Quick Action Modals */}
      <NewSaleModal
        isOpen={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        initialBuyerId={activeBuyerId}
        onSuccess={() => fetchBuyers()}
      />

      <NewPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        initialBuyerId={activeBuyerId}
        onSuccess={() => fetchBuyers()}
      />

      {/* Delete Buyer Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title={buyerToDelete ? `Delete Buyer "${buyerToDelete.name}"?` : 'Delete Buyer?'}
        message={
          buyerToDelete?.transactionCount > 0
            ? `Warning: "${buyerToDelete.name}" has ${buyerToDelete.transactionCount} transaction(s) with a current balance of ${formatCurrency(buyerToDelete.currentBalance)}. Deleting this buyer will permanently remove their profile and all associated ledger transactions. Are you sure you want to proceed?`
            : `Are you sure you want to permanently delete buyer "${buyerToDelete?.name}"? This action cannot be undone.`
        }
        confirmText={deletingBuyer ? 'Deleting...' : 'Delete Buyer'}
        cancelText="Cancel"
        isDanger={true}
        onConfirm={executeDeleteBuyer}
        onCancel={() => {
          if (!deletingBuyer) {
            setDeleteModalOpen(false);
            setBuyerToDelete(null);
          }
        }}
      />
    </div>

  );
}
