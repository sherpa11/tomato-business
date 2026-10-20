import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  AlertCircle,
  Printer,
  Search,
  Filter,
  ArrowUpDown,
  X
} from 'lucide-react';
import { reportsAPI } from '../api/client';
import { formatCurrency, formatDate, formatBalance } from '../utils/formatters';

export default function Reports() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Customer balance aging search & filters
  const [buyerSearch, setBuyerSearch] = useState('');
  const [dueOnlyFilter, setDueOnlyFilter] = useState(false);
  const [sortByDue, setSortByDue] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsAPI.getReports({ startDate, endDate });
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const rawBuyerBalances = data?.buyerBalances || [];
  const allBuyersCount = rawBuyerBalances.length;
  const dueBuyersCount = rawBuyerBalances.filter((b) => Number(b.currentBalance) > 0).length;

  const processedBuyerBalances = useMemo(() => {
    let list = [...rawBuyerBalances];

    // Filter by Due Only
    if (dueOnlyFilter) {
      list = list.filter((b) => Number(b.currentBalance) > 0);
    }

    // Filter by Search Query (Name or Phone)
    if (buyerSearch.trim()) {
      const q = buyerSearch.trim().toLowerCase();
      list = list.filter(
        (b) =>
          (b.name && b.name.toLowerCase().includes(q)) ||
          (b.phone && b.phone.toLowerCase().includes(q))
      );
    }

    // Sort: if sortByDue or dueOnlyFilter, sort descending by due balance; otherwise alphabetically by name
    if (sortByDue || dueOnlyFilter) {
      list.sort((a, b) => (Number(b.currentBalance) || 0) - (Number(a.currentBalance) || 0));
    } else {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    }

    return list;
  }, [rawBuyerBalances, dueOnlyFilter, buyerSearch, sortByDue]);

  const setPreset = (preset) => {
    let todayStr;
    try {
      todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      todayStr = new Date().toISOString().split('T')[0];
    }

    if (preset === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const parts = todayStr.split('-');
      const firstDay = `${parts[0]}-${parts[1]}-01`;
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center border border-blue-100 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Business Reports & Statements</h1>
            <p className="text-xs text-slate-500 font-medium">Daily & Date-range sales, purchases, and market dues</p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="no-print inline-flex items-center justify-center gap-2 h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-xs transition-all active:scale-[0.98] cursor-pointer w-full sm:w-auto"
        >
          <Printer className="w-4 h-4 shrink-0" />
          <span>Print Report</span>
        </button>
      </div>

      {/* Date Filter Bar */}
      <div className="no-print bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-bold text-slate-700 w-10 sm:w-auto">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none flex-1 sm:flex-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 w-10 sm:w-auto sm:ml-2">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none flex-1 sm:flex-none"
            />
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button
            onClick={() => setPreset('ALL')}
            className="flex-1 sm:flex-none text-xs font-bold px-3 py-2 sm:py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer shadow-2xs text-center"
          >
            All Time
          </button>
          <button
            onClick={() => setPreset('THIS_MONTH')}
            className="flex-1 sm:flex-none text-xs font-bold px-3 py-2 sm:py-1.5 rounded-lg bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 transition-all cursor-pointer shadow-2xs text-center"
          >
            This Month
          </button>
          <button
            onClick={() => setPreset('TODAY')}
            className="flex-1 sm:flex-none text-xs font-bold px-3 py-2 sm:py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all cursor-pointer shadow-2xs text-center"
          >
            Today
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Daily Breakdown Table */}
      <div className="space-y-3">
        <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
          Daily Business Summary
        </h2>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10">Date</th>
                  <th className="py-3 px-4 text-center">Boxes Bought</th>
                  <th className="py-3 px-4 text-right">Purchase Amount</th>
                  <th className="py-3 px-4 text-center">Boxes Sold</th>
                  <th className="py-3 px-4 text-right">Sales Amount</th>
                  <th className="py-3 px-4 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!data?.dailyBreakdown || data.dailyBreakdown.length === 0) ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      No business transactions recorded in this period.
                    </td>
                  </tr>
                ) : (
                  (data?.dailyBreakdown || []).map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 sticky left-0 bg-white z-10 shadow-2xs whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-700 whitespace-nowrap">
                        {row.boxesPurchasedEq} Big
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {formatCurrency(row.purchaseAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-700 whitespace-nowrap">
                        {row.boxesSoldEq} Big
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                        {formatCurrency(row.salesAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                        {formatCurrency(row.receivedAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Customer Balances Register */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
              Customer Balance Aging / Outstanding Register
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              List of customer outstanding dues, tallies, and balances
            </p>
          </div>

          {/* Search & Only Due Filter / Sort Toolbar */}
          <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Input */}
            <div className="relative sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search buyer name..."
                value={buyerSearch}
                onChange={(e) => setBuyerSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-7 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
              />
              {buyerSearch && (
                <button
                  type="button"
                  onClick={() => setBuyerSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Buttons */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setDueOnlyFilter(false)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  !dueOnlyFilter
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({allBuyersCount})
              </button>
              <button
                type="button"
                onClick={() => setDueOnlyFilter(true)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  dueOnlyFilter
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-red-700 hover:bg-red-50'
                }`}
                title="Filter only names who have due and sort by highest due first"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Only With Due ({dueBuyersCount})</span>
              </button>
            </div>

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => setSortByDue((prev) => !prev)}
              className={`h-9 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs ${
                sortByDue || dueOnlyFilter
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Toggle sort order"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortByDue || dueOnlyFilter ? 'Highest Due ↓' : 'Name A-Z'}</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10">Buyer Name</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4 text-right">Current Ledger Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedBuyerBalances.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-slate-400 text-xs">
                      {buyerSearch.trim()
                        ? `No buyers matching "${buyerSearch}".`
                        : dueOnlyFilter
                        ? 'No buyers with outstanding due found.'
                        : 'No active buyers.'}
                    </td>
                  </tr>
                ) : (
                  processedBuyerBalances.map((b) => {
                    const bal = formatBalance(b.currentBalance);
                    return (
                      <tr key={b._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 sticky left-0 bg-white z-10 shadow-2xs whitespace-nowrap">
                          {b.name}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                          {b.phone ? (
                            <a href={`tel:${b.phone}`} className="hover:text-blue-700 font-semibold">
                              {b.phone}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span
                            className={`inline-block font-mono font-black text-xs px-2.5 py-1 rounded-lg border ${bal.color}`}
                          >
                            {bal.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

