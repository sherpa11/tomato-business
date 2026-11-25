import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PlusCircle,
  Receipt,
  CreditCard,
  Package,
  Truck,
  AlertCircle,
  RefreshCw,
  Printer,
  Ban,
  Search,
  X
} from 'lucide-react';
import { dashboardAPI, transactionsAPI, purchasesAPI } from '../api/client';
import { useDate } from '../context/DateContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import TodayTallyTable from '../components/TodayTallyTable';
import PaymentsReceivedTable from '../components/dashboard/PaymentsReceivedTable';
import BoxRatesTable from '../components/dashboard/BoxRatesTable';
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
  const { operationalDate, resetToToday, isToday } = useDate();
  const { settings } = useSettings();
  const { isAdmin } = useAuth();

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

  // Customer search state for Today's Tally table
  const [customerSearch, setCustomerSearch] = useState('');
  // Active Dashboard View: 'TALLY' | 'PAYMENTS' | 'BOX_RATES'
  const [dashboardView, setDashboardView] = useState('TALLY');

  const filteredTodayTally = useMemo(() => {
    const list = data?.todayTally || [];
    const q = customerSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) =>
      (row.buyerName || '').toLowerCase().includes(q)
    );
  }, [data?.todayTally, customerSearch]);

  // Compute payments received by buyer for the operational date (summed per buyer, amountPaid > 0)
  const paymentsReceivedData = useMemo(() => {
    const list = data?.todayTally || [];
    const map = new Map();

    list.forEach((tx) => {
      if (tx.isVoid) return;
      const paid = Math.round(Number(tx.paid ?? tx.amountPaid) || 0);
      if (paid > 0) {
        const key = tx.buyerId ? String(tx.buyerId) : tx.buyerName;
        if (!map.has(key)) {
          map.set(key, {
            buyerId: tx.buyerId,
            buyerName: tx.buyerName,
            totalPaid: paid
          });
        } else {
          const existing = map.get(key);
          existing.totalPaid = Math.round(existing.totalPaid + paid);
        }
      }
    });

    let results = Array.from(map.values());
    const q = customerSearch.trim().toLowerCase();
    if (q) {
      results = results.filter((p) => (p.buyerName || '').toLowerCase().includes(q));
    }
    return results;
  }, [data?.todayTally, customerSearch]);

  // Compute boxes purchased by individual rate (strictly preserving entered rate without ever averaging)
  const boxRatesData = useMemo(() => {
    const list = data?.todayTally || [];
    const rateMap = new Map();

    list.forEach((tx) => {
      if (tx.isVoid) return;
      if (tx.type !== 'SALE') return;

      const buyerId = tx.buyerId;
      const buyerName = tx.buyerName;

      if (Array.isArray(tx.items) && tx.items.length > 0) {
        tx.items.forEach((item) => {
          const big = Number(item.bigBoxes) || 0;
          const small = Number(item.smallBoxes) || 0;
          const rate = Math.round(Number(item.ratePerBigBox) || 0);
          if ((big > 0 || small > 0) && rate > 0) {
            const boxType = big > 0 && small > 0 ? 'MIXED' : (big > 0 ? 'BIG' : 'SMALL');
            const key = `${buyerId || buyerName}__${rate}__${boxType}`;
            if (!rateMap.has(key)) {
              rateMap.set(key, {
                buyerId,
                buyerName,
                rate,
                boxType,
                bigBoxes: big,
                smallBoxes: small
              });
            } else {
              const existing = rateMap.get(key);
              existing.bigBoxes += big;
              existing.smallBoxes += small;
            }
          }
        });
      } else {
        const big = Number(tx.bigBoxes) || 0;
        const small = Number(tx.smallBoxes) || 0;
        const rate = Math.round(Number(tx.ratePerBigBox) || 0);
        if ((big > 0 || small > 0) && rate > 0) {
          const boxType = big > 0 && small > 0 ? 'MIXED' : (big > 0 ? 'BIG' : 'SMALL');
          const key = `${buyerId || buyerName}__${rate}__${boxType}`;
          if (!rateMap.has(key)) {
            rateMap.set(key, {
              buyerId,
              buyerName,
              rate,
              boxType,
              bigBoxes: big,
              smallBoxes: small
            });
          } else {
            const existing = rateMap.get(key);
            existing.bigBoxes += big;
            existing.smallBoxes += small;
          }
        }
      }
    });

    let results = Array.from(rateMap.values());
    const q = customerSearch.trim().toLowerCase();
    if (q) {
      results = results.filter((r) => (r.buyerName || '').toLowerCase().includes(q));
    }
    return results;
  }, [data?.todayTally, customerSearch]);

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
            {!isToday && (
              <button
                type="button"
                onClick={resetToToday}
                className="text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded-md cursor-pointer transition-colors active:scale-95"
                title="Reset to today's date"
              >
                Reset to Today
              </button>
            )}
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

          {isAdmin && (
            <button
              onClick={() => setPurchaseModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>+ Purchase</span>
            </button>
          )}

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

      {/* SECTION 1: TODAY'S TALLY & FILTERED VIEWS (Highest Priority) */}
      <div className="space-y-3">
        {/* View Switcher Bar & Search Control */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-2.5 sm:p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
          {/* Filter Pills / Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setDashboardView('TALLY')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                dashboardView === 'TALLY'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>Daily Tally</span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                  dashboardView === 'TALLY' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {data?.todayTally?.length || 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDashboardView('PAYMENTS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                dashboardView === 'PAYMENTS'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Payments Received</span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                  dashboardView === 'PAYMENTS' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {paymentsReceivedData.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDashboardView('BOX_RATES')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                dashboardView === 'BOX_RATES'
                  ? 'bg-white text-red-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>Boxes Purchased by Rate</span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                  dashboardView === 'BOX_RATES' ? 'bg-red-100 text-red-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {boxRatesData.length}
              </span>
            </button>
          </div>

          {/* Right Controls: Customer Search & Add Bill Button */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search customer name..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full h-8 sm:h-9 pl-8 pr-7 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-2xs transition-all"
              />
              {customerSearch && (
                <button
                  type="button"
                  onClick={() => setCustomerSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => setSaleModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 sm:h-9 px-3 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Add Bill</span>
            </button>
          </div>
        </div>

        {/* View Content based on active tab */}
        {dashboardView === 'TALLY' && (
          <TodayTallyTable
            tally={filteredTodayTally}
            allTally={data?.todayTally}
            summary={data?.summary}
            isFiltered={Boolean(customerSearch.trim())}
            searchTerm={customerSearch.trim()}
            onPrint={handlePrintBuyerBill}
            onVoid={promptVoidTransaction}
            onEditCustomer={(bId) => {
              setEditBuyerId(bId);
              setEditBuyerModalOpen(true);
            }}
          />
        )}

        {dashboardView === 'PAYMENTS' && (
          <PaymentsReceivedTable
            payments={paymentsReceivedData}
            searchTerm={customerSearch.trim()}
          />
        )}

        {dashboardView === 'BOX_RATES' && (
          <BoxRatesTable
            boxRates={boxRatesData}
            searchTerm={customerSearch.trim()}
          />
        )}
      </div>

      {/* SECTION 2: TODAY'S SUPPLIER PURCHASES (Admin Only) */}
      {isAdmin && (
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

      )}

      {/* Modals */}
      <NewSaleModal
        isOpen={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        onSuccess={(sale) => {
          fetchDashboardData();
          handlePrintBuyerBill(sale);
        }}
      />

      {isAdmin && (
        <NewPurchaseModal
          isOpen={purchaseModalOpen}
          onClose={() => setPurchaseModalOpen(false)}
          onSuccess={(purchase) => {
            fetchDashboardData();
            handlePrintSupplierVoucher(purchase);
          }}
        />
      )}

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
