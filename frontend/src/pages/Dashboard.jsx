import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  Receipt,
  CreditCard,
  Truck,
  AlertCircle,
  RefreshCw,
  Printer,
  Ban
} from 'lucide-react';
import { dashboardAPI, transactionsAPI, purchasesAPI } from '../api/client';
import { useDate } from '../context/DateContext';
import { useSettings } from '../context/SettingsContext';
import TodayTallyTable from '../components/TodayTallyTable';
import NewSaleModal from '../components/modals/NewSaleModal';
import NewPurchaseModal from '../components/modals/NewPurchaseModal';
import NewPaymentModal from '../components/modals/NewPaymentModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import EditBuyerModal from '../components/modals/EditBuyerModal';
import PrintModal from '../components/print/PrintModal';
import BuyerBillTemplate from '../components/print/BuyerBillTemplate';
import SupplierVoucherTemplate from '../components/print/SupplierVoucherTemplate';
import { formatCurrency, formatDate, formatBoxDescription } from '../utils/formatters';

export default function Dashboard() {
  const { operationalDate } = useDate();
  const { settings } = useSettings();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Modals state
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Edit Buyer modal state
  const [editBuyerModalOpen, setEditBuyerModalOpen] = useState(false);
  const [editBuyerId, setEditBuyerId] = useState(null);

  // Print state
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printItem, setPrintItem] = useState(null);
  const [printType, setPrintType] = useState('BUYER'); // 'BUYER' or 'SUPPLIER'

  // Void confirmation state
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidItem, setVoidItem] = useState(null);
  const [voidType, setVoidType] = useState('TRANSACTION'); // 'TRANSACTION' or 'PURCHASE'
  const [voidReason, setVoidReason] = useState('');

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dashboardAPI.getSummary(operationalDate);
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard summary');
    } finally {
      setLoading(false);
    }
  }, [operationalDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Listen for mobile bottom nav quick bill event
  useEffect(() => {
    const handleQuickSale = () => setSaleModalOpen(true);
    window.addEventListener('open-quick-sale', handleQuickSale);
    return () => window.removeEventListener('open-quick-sale', handleQuickSale);
  }, []);

  // Handlers for printing
  const handlePrintBuyerBill = (row) => {
    setPrintItem({
      ...row,
      transactionDate: operationalDate
    });
    setPrintType('BUYER');
    setPrintModalOpen(true);
  };

  const handlePrintSupplierVoucher = (purchase) => {
    setPrintItem(purchase);
    setPrintType('SUPPLIER');
    setPrintModalOpen(true);
  };

  // Handlers for voiding
  const promptVoidTransaction = (row) => {
    setVoidItem(row);
    setVoidType('TRANSACTION');
    setVoidReason('');
    setVoidModalOpen(true);
  };

  const promptVoidPurchase = (purchase) => {
    setVoidItem(purchase);
    setVoidType('PURCHASE');
    setVoidReason('');
    setVoidModalOpen(true);
  };

  const executeVoid = async () => {
    if (!voidItem) return;
    try {
      if (voidType === 'TRANSACTION') {
        await transactionsAPI.voidTransaction(voidItem.transactionId || voidItem.id, { voidReason });
      } else {
        await purchasesAPI.voidPurchase(voidItem._id, { voidReason });
      }
      setVoidModalOpen(false);
      fetchDashboardData();
    } catch (err) {
      alert(err.message || 'Failed to void transaction');
    }
  };


  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/tomato.png" alt="Tomato" className="w-7 h-7 sm:w-8 sm:h-8 object-contain filter drop-shadow-xs" />
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {settings.businessName || 'TOMATO BUSINESS'}
              </h1>
            </div>
            <button
              onClick={fetchDashboardData}
              className="md:hidden w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-600' : ''}`} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Operating Date:</span>
            <span className="font-extrabold text-slate-900 bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 rounded-lg font-mono">
              {formatDate(operationalDate)}
            </span>
          </div>
        </div>

        {/* Large Market Touch Buttons with Responsive Layout */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setSaleModalOpen(true)}
            className="col-span-2 sm:flex-initial inline-flex items-center justify-center gap-2 h-12 sm:h-11 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Receipt className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
            <span>+ Buyer Bill</span>
          </button>

          <button
            onClick={() => setPaymentModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>+ Payment</span>
          </button>

          <button
            onClick={() => setPurchaseModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Truck className="w-4 h-4 shrink-0" />
            <span>+ Purchase</span>
          </button>

          <button
            onClick={fetchDashboardData}
            className="hidden md:flex w-11 h-11 items-center justify-center text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-2xs cursor-pointer shrink-0"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-600' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* SECTION 1: TODAY'S TALLY TABLE (Highest Priority) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Customer Daily Tally Table
            </h2>
            <span className="text-xs font-extrabold bg-red-50 text-red-700 border border-red-200/70 px-2.5 py-0.5 rounded-full shrink-0">
              {data?.todayTally?.length || 0} Transactions
            </span>
          </div>
          <button
            onClick={() => setSaleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/80 transition-colors cursor-pointer shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Bill</span>
          </button>
        </div>

        <TodayTallyTable
          tally={data?.todayTally || []}
          onPrint={handlePrintBuyerBill}
          onVoid={promptVoidTransaction}
          onEditCustomer={(bId) => {
            setEditBuyerId(bId);
            setEditBuyerModalOpen(true);
          }}
        />
      </div>

      {/* SECTION 2: TODAY'S SUPPLIER PURCHASES */}
      <div className="space-y-3 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Today's Supplier Purchases (Lot Received)
            </h2>
            <span className="text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-2.5 py-0.5 rounded-full shrink-0">
              {data?.todayPurchases?.length || 0} Lots
            </span>
          </div>
          <button
            onClick={() => setPurchaseModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors cursor-pointer shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Lot</span>
          </button>
        </div>

        {(!data?.todayPurchases || data.todayPurchases.length === 0) ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <Truck className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="mt-2 text-sm font-bold text-slate-700">No Supplier Purchases for this Date</h4>
            <p className="text-xs text-slate-500 mt-0.5">Click "+ Purchase Lot" to record morning tomato lots.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4 text-center">Boxes Received</th>
                    <th className="py-3 px-4 text-right">Purchase Rate</th>
                    <th className="py-3 px-4 text-right">Total Purchase</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="no-print py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {(data?.todayPurchases || []).map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{p.supplierName}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-100 font-mono">
                          {formatBoxDescription(p.bigBoxes, p.smallBoxes)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-700">
                        {formatCurrency(p.ratePerBigBox)} / Big Box
                      </td>
                      <td className="py-3.5 px-4 text-right font-black font-mono text-emerald-700 text-base">
                        {formatCurrency(p.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">{p.notes || '—'}</td>
                      <td className="no-print py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handlePrintSupplierVoucher(p)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200/80 bg-white transition-colors cursor-pointer"
                            title="Print Voucher"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => promptVoidPurchase(p)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-700 hover:bg-red-50 border border-slate-200/80 bg-white transition-colors cursor-pointer"
                            title="Void Purchase"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewSaleModal
        isOpen={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        onSuccess={(sale) => {
          fetchDashboardData();
          handlePrintBuyerBill(sale);
        }}
      />

      <NewPurchaseModal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        onSuccess={(purchase) => {
          fetchDashboardData();
          handlePrintSupplierVoucher(purchase);
        }}
      />

      <NewPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={() => {
          fetchDashboardData();
        }}
      />

      {/* Edit Customer Profile Modal */}
      <EditBuyerModal
        isOpen={editBuyerModalOpen}
        onClose={() => setEditBuyerModalOpen(false)}
        buyerId={editBuyerId}
        onSuccess={() => {
          fetchDashboardData();
        }}
      />

      {/* Print Modal */}
      <PrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title={printType === 'BUYER' ? 'Buyer Bill Print' : 'Supplier Purchase Voucher Print'}
      >
        {printType === 'BUYER' ? (
          <BuyerBillTemplate transaction={printItem} settings={settings} />
        ) : (
          <SupplierVoucherTemplate purchase={printItem} settings={settings} />
        )}
      </PrintModal>

      {/* Confirm Void Modal */}
      <ConfirmModal
        isOpen={voidModalOpen}
        title={`Void ${voidType === 'TRANSACTION' ? 'Buyer Transaction' : 'Supplier Purchase'}?`}
        message={`Are you sure you want to void this record? This will exclude it from calculations and automatically recalculate affected buyer balances chronologically.`}
        confirmText="Void Record"
        needsReason={true}
        reasonValue={voidReason}
        onReasonChange={setVoidReason}
        onConfirm={executeVoid}
        onCancel={() => setVoidModalOpen(false)}
      />
    </div>
  );
}
