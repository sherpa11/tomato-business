import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Phone,
  Eye,
  X,
  AlertCircle,
  Package,
  Calendar,
  Printer,
  Ban,
  Edit2,
  Trash2
} from 'lucide-react';
import { suppliersAPI, purchasesAPI } from '../api/client';
import { useSettings } from '../context/SettingsContext';
import NewPurchaseModal from '../components/modals/NewPurchaseModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import PrintModal from '../components/print/PrintModal';
import SupplierVoucherTemplate from '../components/print/SupplierVoucherTemplate';
import { formatCurrency, formatDate, formatBoxDescription } from '../utils/formatters';

export default function Suppliers() {
  const { settings } = useSettings();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Supplier modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit Supplier modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  // Delete Supplier modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [deletingSupplier, setDeletingSupplier] = useState(false);

  // Add purchase modal

  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [activeSupplierId, setActiveSupplierId] = useState(null);

  // View purchases history drawer
  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [supplierPurchases, setSupplierPurchases] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Print voucher
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printPurchase, setPrintPurchase] = useState(null);

  const handlePrintSupplierPurchase = (p) => {
    setPrintPurchase(p);
    setPrintModalOpen(true);
  };

  // Void purchase
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidPurchaseItem, setVoidPurchaseItem] = useState(null);
  const [voidReason, setVoidReason] = useState('');

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await suppliersAPI.getSuppliers();
      if (res.success) {
        setSuppliers(res.suppliers);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) {
      setFormError('Supplier name is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await suppliersAPI.createSupplier({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim()
      });

      if (res.success) {
        setAddModalOpen(false);
        setName('');
        setPhone('');
        setAddress('');
        setNotes('');
        fetchSuppliers();
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create supplier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (s) => {
    setEditingSupplier(s);
    setEditName(s.name || '');
    setEditPhone(s.phone || '');
    setEditAddress(s.address || '');
    setEditNotes(s.notes || '');
    setEditActive(s.active !== undefined ? s.active : true);
    setEditFormError('');
    setEditModalOpen(true);
  };

  const handleUpdateSupplier = async (e) => {
    e.preventDefault();
    setEditFormError('');
    if (!editName.trim()) {
      setEditFormError('Supplier name is required');
      return;
    }

    setSubmittingEdit(true);
    try {
      const res = await suppliersAPI.updateSupplier(editingSupplier._id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
        active: editActive
      });

      if (res.success) {
        setEditModalOpen(false);
        setEditingSupplier(null);
        fetchSuppliers();
        if (viewingSupplier && viewingSupplier._id === editingSupplier._id) {
          setViewingSupplier(res.supplier);
        }
      }
    } catch (err) {
      setEditFormError(err.message || 'Failed to update supplier');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleViewPurchases = async (supplier) => {
    setViewingSupplier(supplier);
    setHistoryLoading(true);
    try {
      const res = await suppliersAPI.getSupplierPurchases(supplier._id);
      if (res.success) {
        setSupplierPurchases(res.purchases);
      }
    } catch (err) {
      alert('Failed to load supplier purchase history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenAddPurchase = (supplierId) => {
    setActiveSupplierId(supplierId);
    setPurchaseModalOpen(true);
  };

  const promptVoid = (p) => {
    setVoidPurchaseItem(p);
    setVoidReason('');
    setVoidModalOpen(true);
  };

  const executeVoid = async () => {
    if (!voidPurchaseItem) return;
    try {
      await purchasesAPI.voidPurchase(voidPurchaseItem._id, { voidReason });
      setVoidModalOpen(false);
      fetchSuppliers();
      if (viewingSupplier) {
        handleViewPurchases(viewingSupplier);
      }
    } catch (err) {
      alert(err.message || 'Failed to void purchase');
    }
  };

  const promptDeleteSupplier = (s) => {
    setSupplierToDelete(s);
    setDeleteModalOpen(true);
  };

  const executeDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    setDeletingSupplier(true);
    try {
      const res = await suppliersAPI.deleteSupplier(supplierToDelete._id);
      if (res.success) {
        setDeleteModalOpen(false);
        if (viewingSupplier && viewingSupplier._id === supplierToDelete._id) {
          setViewingSupplier(null);
        }
        setSupplierToDelete(null);
        fetchSuppliers();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete supplier');
    } finally {
      setDeletingSupplier(false);
    }
  };


  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center border border-emerald-100 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Suppliers Directory</h1>
            <p className="text-xs text-slate-500 font-medium">Daily tomato arrivals & purchase lot tracking</p>
          </div>
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Add Supplier</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Supplier List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No suppliers registered. Click "+ Add Supplier" to register.
          </div>
        ) : (
          <>
            {/* Mobile Cards View (< sm) */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {suppliers.map((s) => (
                <div key={s._id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-black text-slate-900 text-base leading-tight">
                        {s.name}
                      </div>
                      {s.notes && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{s.notes}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-emerald-700 text-base">
                        {formatCurrency(s.totalPurchaseAmount)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Total Purchases
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact</span>
                      {s.phone ? (
                        <a
                          href={`tel:${s.phone}`}
                          className="font-mono text-emerald-700 font-bold inline-flex items-center gap-1 mt-0.5"
                        >
                          <Phone className="w-3 h-3 shrink-0" />
                          <span className="truncate">{s.phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 mt-0.5 block">—</span>
                      )}
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Big Eqv</span>
                      <span className="font-mono font-extrabold text-slate-800 mt-0.5 block">
                        {s.totalBigEquivalent}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Lots</span>
                      <span className="font-bold text-slate-700 mt-0.5 block">
                        {s.transactionCount} lots
                      </span>
                    </div>
                  </div>

                  {s.lastPurchaseDate && (
                    <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between px-0.5">
                      <span>Last arrival:</span>
                      <span className="font-semibold text-slate-600">{formatDate(s.lastPurchaseDate)}</span>
                    </div>
                  )}

                  {/* Touch Action Buttons */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                      onClick={() => handleViewPurchases(s)}
                      className="h-10 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/70 rounded-xl flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer"
                      title="View Purchases"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>History</span>
                    </button>
                    <button
                      onClick={() => handleOpenAddPurchase(s._id)}
                      className="h-10 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer"
                      title="Add Purchase Lot"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Lot</span>
                    </button>
                    <button
                      onClick={() => handleOpenEdit(s)}
                      className="h-10 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer"
                      title="Edit Supplier"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => promptDeleteSupplier(s)}
                      className="h-10 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer"
                      title="Delete Supplier"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>

                </div>
              ))}
            </div>

            {/* Desktop Table (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4 text-left sticky left-0 bg-slate-50/90 z-10">Supplier Name</th>
                    <th className="py-3 px-4 text-left">Contact</th>
                    <th className="py-3 px-4 text-center">Total Big Eqv</th>
                    <th className="py-3 px-4 text-right">Total Purchases</th>
                    <th className="py-3 px-4 text-center">Total Lots</th>
                    <th className="py-3 px-4 text-center">Last Purchase</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {suppliers.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-left sticky left-0 bg-white z-10 shadow-2xs">
                        <span>{s.name}</span>
                        {s.notes && <span className="text-xs text-slate-400 block font-normal mt-0.5">{s.notes}</span>}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono text-slate-600 text-left">
                        {s.phone ? (
                          <a
                            href={`tel:${s.phone}`}
                            className="inline-flex items-center gap-1.5 hover:text-emerald-700 font-semibold transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {s.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-extrabold font-mono border border-slate-200/60">
                          {s.totalBigEquivalent} Big Eqv
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-black font-mono text-emerald-700 text-base">
                        {formatCurrency(s.totalPurchaseAmount)}
                      </td>

                      <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-700">
                        {s.transactionCount} Lots
                      </td>

                      <td className="py-3.5 px-4 text-center text-xs text-slate-500 font-mono">
                        {formatDate(s.lastPurchaseDate)}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleViewPurchases(s)}
                            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/60 rounded-lg transition-all cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Purchases</span>
                          </button>

                          <button
                            onClick={() => handleOpenAddPurchase(s._id)}
                            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Lot</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(s)}
                            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                            title="Edit Supplier Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => promptDeleteSupplier(s)}
                            className="inline-flex items-center justify-center gap-1 h-8 px-2.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                            title="Delete Supplier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Supplier Purchases Drawer/Modal */}
      {viewingSupplier && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingSupplier(null);
          }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] sm:max-h-[90vh] flex flex-col">
            <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  {viewingSupplier.name} — Purchases
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(viewingSupplier)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                  title="Edit Supplier Details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit Details</span>
                </button>
                <button
                  onClick={() => promptDeleteSupplier(viewingSupplier)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                  title="Delete Supplier"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete Supplier</span>
                </button>
                <button
                  onClick={() => setViewingSupplier(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

              </div>
            </div>

            <div className="flex-1 overflow-y-auto mt-3">
              {historyLoading ? (
                <div className="py-8 text-center text-slate-500 text-sm">Loading purchase lots...</div>
              ) : supplierPurchases.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">No purchases recorded for this supplier.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] sm:text-[11px] font-black uppercase text-slate-600 border-b border-slate-200">
                        <th className="py-2.5 px-2 sm:px-3">Date</th>
                        <th className="py-2.5 px-2 sm:px-3">Boxes</th>
                        <th className="py-2.5 px-2 sm:px-3 text-right">Rate</th>
                        <th className="py-2.5 px-2 sm:px-3 text-right">Total</th>
                        <th className="py-2.5 px-2 sm:px-3 hidden sm:table-cell">Notes</th>
                        <th className="py-2.5 px-2 sm:px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {supplierPurchases.map((p) => (
                        <tr
                          key={p._id}
                          className={p.isVoid ? 'opacity-40 line-through bg-red-50/20' : 'hover:bg-slate-50'}
                        >
                          <td className="py-2.5 sm:py-3 px-2 sm:px-3 whitespace-nowrap">{formatDate(p.transactionDate)}</td>
                          <td className="py-2.5 sm:py-3 px-2 sm:px-3 font-sans font-semibold">
                            {formatBoxDescription(p.bigBoxes, p.smallBoxes)}
                          </td>
                          <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-right">{formatCurrency(p.ratePerBigBox)}</td>
                          <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-right font-black text-emerald-700 text-xs sm:text-sm">
                            {formatCurrency(p.totalAmount)}
                          </td>
                          <td className="py-2.5 sm:py-3 px-2 sm:px-3 font-sans text-slate-500 hidden sm:table-cell">{p.notes || '—'}</td>
                          <td className="py-2.5 sm:py-3 px-2 sm:px-3 text-center whitespace-nowrap">
                            {!p.isVoid && (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handlePrintSupplierPurchase(p)}
                                  className="p-1.5 text-slate-600 hover:text-emerald-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                                  title="Print Voucher"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => promptVoid(p)}
                                  className="p-1.5 text-slate-400 hover:text-red-700 rounded-lg hover:bg-red-50 cursor-pointer"
                                  title="Void"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Add New Supplier</h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSupplier} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Name *</label>
                <input
                  type="text"
                  placeholder="e.g. A1, Kisan Tomato Mandi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full text-sm font-semibold border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="e.g. 9811122233"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Address (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Nashik Tomato Yard #2"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Regular morning truck delivery"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {editModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditModalOpen(false);
          }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Edit Supplier</h3>
                  <p className="text-xs text-slate-500 font-medium">Update supplier contact & profile</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editFormError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editFormError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSupplier} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Name *</label>
                <input
                  type="text"
                  placeholder="e.g. A1, Kisan Tomato Mandi"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full text-sm font-semibold border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="e.g. 9811122233"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Address / Yard (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Nashik Tomato Yard #2"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Regular morning truck delivery"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editSupplierActive"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="editSupplierActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Active Supplier (Uncheck to hide from daily purchase list)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Purchase Modal */}
      <NewPurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        initialSupplierId={activeSupplierId}
        onSuccess={() => {
          fetchSuppliers();
          if (viewingSupplier) {
            handleViewPurchases(viewingSupplier);
          }
        }}
      />

      {/* Print Voucher Modal */}
      <PrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title="Supplier Purchase Voucher Print"
      >
        <SupplierVoucherTemplate purchase={printPurchase} settings={settings} />
      </PrintModal>

      {/* Void Modal */}
      <ConfirmModal
        isOpen={voidModalOpen}
        title="Void Supplier Purchase?"
        message="Are you sure you want to void this purchase voucher? It will be excluded from all totals."
        confirmText="Void Purchase"
        needsReason={true}
        reasonValue={voidReason}
        onReasonChange={setVoidReason}
        onConfirm={executeVoid}
        onCancel={() => setVoidModalOpen(false)}
      />

      {/* Delete Supplier Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title={supplierToDelete ? `Delete Supplier "${supplierToDelete.name}"?` : 'Delete Supplier?'}
        message={
          supplierToDelete?.transactionCount > 0
            ? `Warning: "${supplierToDelete.name}" has ${supplierToDelete.transactionCount} purchase lot(s) totaling ${formatCurrency(supplierToDelete.totalPurchaseAmount)}. Deleting this supplier will permanently remove their profile and all associated purchase records. Are you sure you want to proceed?`
            : `Are you sure you want to permanently delete supplier "${supplierToDelete?.name}"? This action cannot be undone.`
        }
        confirmText={deletingSupplier ? 'Deleting...' : 'Delete Supplier'}
        cancelText="Cancel"
        isDanger={true}
        onConfirm={executeDeleteSupplier}
        onCancel={() => {
          if (!deletingSupplier) {
            setDeleteModalOpen(false);
            setSupplierToDelete(null);
          }
        }}
      />
    </div>
  );
}

