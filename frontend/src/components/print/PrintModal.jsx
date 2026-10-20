import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, CheckCircle2, Loader2, ChevronDown, ChevronUp, Download, Monitor, Settings, Save, AlertTriangle } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { printAPI, purchasesAPI, transactionsAPI } from '../../api/client';
import { roundMoney } from '../../utils/formatters';

export default function PrintModal({ isOpen, onClose, title = 'Print Preview', children }) {
  const { settings } = useSettings();
  const [printFormat, setPrintFormat] = useState(settings?.thermalPrintWidth || '80mm');

  // Print service states
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [printMessage, setPrintMessage] = useState('');
  const [printerInfo, setPrinterInfo] = useState({ hasCanon: true, defaultPrinter: 'Canon G3030 series' });
  const [showOptions, setShowOptions] = useState(false);

  // Determine what type of document is being printed
  const isBuyerBill = title.toLowerCase().includes('buyer') || Boolean(children?.props?.transaction);
  const isSupplierBill = title.toLowerCase().includes('supplier') || Boolean(children?.props?.purchase);

  // Exact unscaled dimensions in screen pixels (at standard 96 DPI: 1 inch = 25.4mm)
  // 89mm = 336.38px; 105mm = 396.85px; 148mm = 559.37px
  const baseWidthPx = isBuyerBill ? 336.38 : isSupplierBill ? 396.85 : 302.36;
  const baseHeightPx = isBuyerBill ? 336.38 : isSupplierBill ? 559.37 : null;

  const scrollAreaRef = React.useRef(null);
  const [previewScale, setPreviewScale] = useState(1);

  // Auto-scale preview on mobile/smaller screens to prevent horizontal clipping
  useEffect(() => {
    if (!isOpen) return;

    const computeScale = () => {
      if (!scrollAreaRef.current) return;
      const clientW = scrollAreaRef.current.clientWidth;
      const availableW = clientW - 12; // Small 6px padding on sides
      if (availableW > 0 && availableW < baseWidthPx) {
        setPreviewScale(availableW / baseWidthPx);
      } else {
        setPreviewScale(1);
      }
    };

    computeScale();
    const timer = setTimeout(computeScale, 50);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && scrollAreaRef.current) {
      ro = new ResizeObserver(computeScale);
      ro.observe(scrollAreaRef.current);
    }

    window.addEventListener('resize', computeScale);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', computeScale);
      if (ro) ro.disconnect();
    };
  }, [isOpen, baseWidthPx]);

  // Manage body class so print CSS knows PrintModal is active
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('print-modal-active');
      // Query local printer status from backend
      printAPI.getStatus()
        .then((res) => {
          if (res?.success) {
            setPrinterInfo({
              hasCanon: res.hasCanon,
              defaultPrinter: res.defaultPrinter || 'Canon G3030 series'
            });
          }
        })
        .catch(() => {
          // Keep default Canon G3030 series
        });
    } else {
      document.body.classList.remove('print-modal-active');
      setIsPrinting(false);
      setPrintSuccess(false);
      setPrintMessage('');
      setShowOptions(false);
    }
    return () => {
      document.body.classList.remove('print-modal-active');
    };
  }, [isOpen]);

  const rawTransaction = children?.props?.transaction;
  const rawPurchase = children?.props?.purchase;
  const type = isBuyerBill ? 'buyer' : isSupplierBill ? 'supplier' : 'buyer';

  // Helper to construct an immediate synchronous bill from raw transaction
  const buildImmediateBuyerBill = useCallback((t) => {
    if (!t) return null;
    if (t.items && t.items.length > 0) return t;
    const big = Number(t.bigBoxes) || 0;
    const small = Number(t.smallBoxes) || 0;
    const bigEq = Number(t.bigEquivalent) || (big + small / 2);
    const rate = Number(t.ratePerBigBox) || 0;
    let lineAmt = 0;
    if (t.type === 'SALE' || !t.type) {
      lineAmt = Number(t.billAmount) || (rate > 0 && bigEq > 0 ? Math.round(rate * bigEq * 100) / 100 : 0);
    } else {
      lineAmt = Number(t.amountPaid) || 0;
    }

    const descLine1 = big > 0 && small === 0
      ? 'தக்காளி பெரிய பெட்டி'
      : small > 0 && big === 0
      ? 'தக்காளி சிறிய பெட்டி'
      : t.type === 'PAYMENT'
      ? 'பணம் செலுத்தியது'
      : 'தக்காளி பெட்டி';
    const descLine2 = big > 0 && small > 0
      ? `(${big} Big + ${small} Small)`
      : small > 0
      ? '(Small Box)'
      : t.type === 'PAYMENT'
      ? '(Cash Receipt)'
      : '(Big Box)';

    return {
      buyerId: t.buyerId,
      buyerName: t.buyerName,
      transactionDate: t.transactionDate,
      todayBill: lineAmt,
      billAmount: lineAmt,
      oldBalance: Number(t.oldBalance) || 0,
      totalDue: Number(t.totalDue) || ((Number(t.oldBalance) || 0) + lineAmt),
      amountPaid: Number(t.amountPaid) || 0,
      paid: Number(t.amountPaid) || 0,
      newBalance: Number(t.newBalance) || 0,
      items: [
        {
          _id: t._id,
          ratePerBigBox: rate,
          bigBoxes: big,
          smallBoxes: small,
          bigEquivalent: bigEq,
          lineAmount: lineAmt,
          billAmount: lineAmt,
          descLine1,
          descLine2,
          qtyText: big > 0 && small === 0 ? `${big}` : `${bigEq}`
        }
      ]
    };
  }, []);

  // Helper to construct an immediate synchronous bill from raw purchase
  const buildImmediateBill = useCallback((p) => {
    if (!p) return null;
    if (p.items && p.items.length > 0) return p;
    const big = Number(p.bigBoxes) || 0;
    const small = Number(p.smallBoxes) || 0;
    const bigEq = Number(p.bigEquivalent) || (big + small / 2);
    const rate = Number(p.ratePerBigBox) || 0;
    const total = Number(p.totalAmount) || (bigEq * rate);
    const descLine1 = big > 0 && small === 0
      ? 'தக்காளி பெரிய பெட்டி'
      : small > 0 && big === 0
      ? 'தக்காளி சிறிய பெட்டி'
      : 'தக்காளி பெட்டி';
    const descLine2 = big > 0 && small > 0
      ? `(${big} Big + ${small} Small)`
      : small > 0
      ? '(Small Box)'
      : '(Big Box)';

    return {
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      transactionDate: p.transactionDate,
      lotNumber: p.lotNumber || (p._id ? String(p._id).slice(-4) : '001'),
      grossTotal: total,
      items: [
        {
          _id: p._id,
          ratePerBigBox: rate,
          bigBoxes: big,
          smallBoxes: small,
          bigEquivalent: bigEq,
          lineAmount: total,
          totalAmount: total,
          descLine1,
          descLine2,
          qtyText: big > 0 && small === 0 ? `${big}` : `${bigEq}`
        }
      ],
      itemCount: 1,
      deductions: p.deductions || { commission: 0, gate: 0, coolie: 0, rent: 0, debit: 0, totalDeductions: 0 },
      netTotal: total
    };
  }, []);

  // Consolidated buyer bill state
  const [buyerBill, setBuyerBill] = useState(null);

  // Consolidated supplier bill & deductions state
  const [supplierBill, setSupplierBill] = useState(null);
  const [isLoadingConsolidated, setIsLoadingConsolidated] = useState(false);
  const [deductions, setDeductions] = useState({
    commission: '',
    gate: '',
    coolie: '',
    rent: '',
    debit: ''
  });
  const [deductionsModified, setDeductionsModified] = useState(false);
  const [isSavingDeductions, setIsSavingDeductions] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeductionsPanel, setShowDeductionsPanel] = useState(true);

  // Load consolidated buyer bill when opening modal for a buyer
  useEffect(() => {
    if (!isOpen || !isBuyerBill || !rawTransaction) {
      setBuyerBill(null);
      return;
    }

    setBuyerBill((prev) => prev || buildImmediateBuyerBill(rawTransaction));

    let isMounted = true;
    setIsLoadingConsolidated(true);

    const fetchConsolidated = async () => {
      try {
        const buyerIdVal = rawTransaction.buyerId?._id || rawTransaction.buyerId;
        const res = await transactionsAPI.getConsolidated({
          buyerId: buyerIdVal,
          transactionDate: rawTransaction.transactionDate,
          transactionId: rawTransaction._id
        });
        if (isMounted && res?.success && res.bill) {
          setBuyerBill(res.bill);
        }
      } catch (err) {
        console.warn('[PrintModal] Could not fetch consolidated buyer bill:', err.message);
      } finally {
        if (isMounted) setIsLoadingConsolidated(false);
      }
    };

    fetchConsolidated();
    return () => {
      isMounted = false;
    };
  }, [isOpen, isBuyerBill, rawTransaction, buildImmediateBuyerBill]);

  // Load consolidated supplier bill when opening modal for a supplier
  useEffect(() => {
    if (!isOpen || !isSupplierBill || !rawPurchase) {
      setSupplierBill(null);
      return;
    }

    // Set immediate bill synchronously on render so modal and deductions appear in 0ms
    setSupplierBill((prev) => prev || buildImmediateBill(rawPurchase));

    let isMounted = true;
    setIsLoadingConsolidated(true);

    const fetchConsolidated = async () => {
      try {
        const res = await purchasesAPI.getConsolidated({
          supplierId: rawPurchase.supplierId,
          transactionDate: rawPurchase.transactionDate,
          purchaseId: rawPurchase._id
        });
        if (isMounted && res?.success && res.bill) {
          setSupplierBill(res.bill);
          const d = res.bill.deductions || {};
          setDeductions((prev) => {
            if (deductionsModified) return prev;
            return {
              commission: d.commission ? String(d.commission) : '',
              gate: d.gate ? String(d.gate) : '',
              coolie: d.coolie ? String(d.coolie) : '',
              rent: d.rent ? String(d.rent) : '',
              debit: d.debit ? String(d.debit) : ''
            };
          });
        }
      } catch (err) {
        console.warn('[PrintModal] Could not fetch consolidated bill:', err.message);
      } finally {
        if (isMounted) setIsLoadingConsolidated(false);
      }
    };

    fetchConsolidated();
    return () => {
      isMounted = false;
    };
  }, [isOpen, isSupplierBill, rawPurchase, buildImmediateBill]);

  // Recalculate bill whenever deductions change
  const handleDeductionChange = (field, value) => {
    if (value !== '' && (isNaN(Number(value)) || Number(value) < 0)) return;

    const updatedDeductions = {
      ...deductions,
      [field]: value
    };
    setDeductions(updatedDeductions);
    setDeductionsModified(true);
    setSaveSuccess(false);

    if (supplierBill) {
      const comm = Number(updatedDeductions.commission) || 0;
      const g = Number(updatedDeductions.gate) || 0;
      const c = Number(updatedDeductions.coolie) || 0;
      const r = Number(updatedDeductions.rent) || 0;
      const deb = Number(updatedDeductions.debit) || 0;
      const totalDed = Math.round((comm + g + c + r + deb) * 100) / 100;
      const gross = Number(supplierBill.grossTotal) || 0;
      const net = Math.round((gross - totalDed) * 100) / 100;

      setSupplierBill({
        ...supplierBill,
        deductions: {
          commission: comm,
          gate: g,
          coolie: c,
          rent: r,
          debit: deb,
          totalDeductions: totalDed
        },
        netTotal: net
      });
    }
  };

  // Save deductions to backend
  const handleSaveDeductions = async () => {
    if (!supplierBill?.supplierId || !supplierBill?.transactionDate) return;
    setIsSavingDeductions(true);
    try {
      const comm = Number(deductions.commission) || 0;
      const g = Number(deductions.gate) || 0;
      const c = Number(deductions.coolie) || 0;
      const r = Number(deductions.rent) || 0;
      const deb = Number(deductions.debit) || 0;

      const res = await purchasesAPI.saveDeductions({
        supplierId: supplierBill.supplierId,
        transactionDate: supplierBill.transactionDate,
        commission: comm,
        gate: g,
        coolie: c,
        rent: r,
        debit: deb
      });

      if (res?.success && res.bill) {
        setSupplierBill(res.bill);
        setDeductionsModified(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('[PrintModal] Failed to save deductions:', err);
    } finally {
      setIsSavingDeductions(false);
    }
  };

  // Effective purchase and transaction objects for printing
  const effectivePurchase = isSupplierBill ? (supplierBill || rawPurchase) : rawPurchase;
  const effectiveTransaction = isBuyerBill ? (buyerBill || rawTransaction) : rawTransaction;

  // 1. Browser Print Fallback
  const handleBrowserPrint = async () => {
    if (isSupplierBill && deductionsModified) {
      await handleSaveDeductions();
    }
    setShowOptions(false);
    const origTitle = document.title;
    document.title = isBuyerBill ? 'Buyer_Bill_89x89mm' : isSupplierBill ? 'Supplier_Bill_A6' : 'Customer_Statement';
    window.print();
    setTimeout(() => {
      document.title = origTitle;
    }, 1000);
  };

  // 2. Direct Print to Canon G3030
  const handleDirectPrint = async (openDialog = false) => {
    setShowOptions(false);
    if (!effectiveTransaction && !effectivePurchase) {
      handleBrowserPrint();
      return;
    }

    if (isSupplierBill && deductionsModified) {
      await handleSaveDeductions();
    }

    setIsPrinting(true);
    setPrintMessage(openDialog ? 'Opening Windows Print Dialog...' : 'Sending to Canon G3030...');

    try {
      const res = await printAPI.directPrint({
        type,
        transaction: effectiveTransaction,
        purchase: effectivePurchase,
        printerName: printerInfo.defaultPrinter || 'Canon G3030 series',
        openDialog,
        silent: !openDialog
      });

      if (res?.success) {
        setPrintSuccess(true);
        setPrintMessage(openDialog ? 'Print Dialog Opened' : `Printed to ${res.printer || 'Canon G3030'}`);
        setTimeout(() => {
          setPrintSuccess(false);
          setPrintMessage('');
        }, 4000);
      } else {
        throw new Error(res?.message || 'Print job failed');
      }
    } catch (err) {
      console.warn('[PrintModal] Direct print failed, offering browser fallback:', err);
      setPrintMessage('Direct print failed. Opening browser print...');
      setTimeout(() => {
        handleBrowserPrint();
      }, 800);
    } finally {
      setIsPrinting(false);
    }
  };

  // 3. Download verified 1-page PDF
  const handleDownloadPdf = async () => {
    setShowOptions(false);
    if (isSupplierBill && deductionsModified) {
      await handleSaveDeductions();
    }
    try {
      const blob = await printAPI.streamPdf({ type, transaction: effectiveTransaction, purchase: effectivePurchase });
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', isBuyerBill ? 'Buyer_Bill_89x89mm.pdf' : 'Supplier_Bill_A6.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      handleBrowserPrint();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="print-modal-portal fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="print-modal-container bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-3 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[96vh] sm:max-h-[94vh] flex flex-col">
        {/* Mobile Drag Indicator */}
        <div className="no-print sm:hidden w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-2.5" />

        {/* Modal Controls (No print) */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">{title}</h3>
                {printerInfo.hasCanon && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Canon G3030 Ready
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500">
                {isBuyerBill
                  ? 'Paper size: 89mm × 89mm (Square Mandi Bill)'
                  : isSupplierBill
                  ? 'Paper size: 105mm × 148mm (A6 Purchase Voucher)'
                  : 'Customer statement ledger'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="sm:hidden text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
            {/* Paper Size Indicator / Format Toggle */}
            {isBuyerBill ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>89 × 89 mm</span>
              </span>
            ) : isSupplierBill ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-800 border border-red-200 rounded-lg text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-red-600" />
                <span>A6 (105 × 148 mm)</span>
              </span>
            ) : (
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPrintFormat('80mm')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    printFormat === '80mm' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-600'
                  }`}
                >
                  Thermal (80mm)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('A4')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    printFormat === 'A4' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-600'
                  }`}
                >
                  A4 Page
                </button>
              </div>
            )}

            {/* Direct Print Button with Action Menu */}
            <div className="relative inline-flex items-stretch shadow-xs rounded-xl">
              <button
                onClick={() => handleDirectPrint(false)}
                disabled={isPrinting}
                className={`flex items-center justify-center gap-2 px-4 h-10 sm:h-9 text-white rounded-l-xl text-sm font-bold cursor-pointer active:scale-95 transition-all ${
                  printSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : isPrinting
                    ? 'bg-slate-700 opacity-90'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {isPrinting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : printSuccess ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                <span>
                  {isPrinting
                    ? 'Printing...'
                    : printSuccess
                    ? 'Printed!'
                    : 'Print Bill'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className="flex items-center justify-center px-2.5 h-10 sm:h-9 bg-emerald-800 hover:bg-emerald-900 text-white rounded-r-xl border-l border-emerald-600/50 cursor-pointer transition-colors"
                title="Printing Options"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {/* Options Dropdown Menu */}
              {showOptions && (
                <div
                  className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleDirectPrint(false)}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div>Direct to Canon G3030</div>
                      <div className="text-[10px] text-slate-400 font-normal">1-click direct USB printing</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDirectPrint(true)}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-blue-600" />
                    <div>
                      <div>Windows Print Dialog</div>
                      <div className="text-[10px] text-slate-400 font-normal">Select tray or custom paper</div>
                    </div>
                  </button>

                  <button
                    onClick={handleBrowserPrint}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Monitor className="w-4 h-4 text-slate-600" />
                    <div>
                      <div>Browser Print Preview</div>
                      <div className="text-[10px] text-slate-400 font-normal">Chrome print dialog fallback</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  <button
                    onClick={handleDownloadPdf}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-600" />
                    <div>
                      <div>Download 1-Page PDF</div>
                      <div className="text-[10px] text-slate-400 font-normal">Exact physical dimensions</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="hidden sm:block text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status notification toast */}
        {printMessage && (
          <div className="no-print mt-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              {printMessage}
            </span>
            <button onClick={() => setPrintMessage('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Supplier Bill Deductions Editor Panel */}
        {isSupplierBill && supplierBill && (
          <div className="no-print mt-2.5 p-2.5 sm:p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
            <div className="flex items-center justify-between gap-2 cursor-pointer select-none" onClick={() => setShowDeductionsPanel(!showDeductionsPanel)}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-emerald-950 inline-flex items-center gap-1.5">
                  <span>கழிவுகள் (Deductions)</span>
                  {isLoadingConsolidated && <Loader2 className="w-3 h-3 animate-spin text-emerald-700" title="Loading consolidated entries..." />}
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">
                  Gross: ₹{(supplierBill.grossTotal || 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200">
                  Deductions: ₹{(supplierBill.deductions?.totalDeductions || 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] font-bold text-emerald-900 bg-emerald-200/60 px-2 py-0.5 rounded-md border border-emerald-300">
                  Net: ₹{(supplierBill.netTotal || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveDeductions();
                  }}
                  disabled={isSavingDeductions}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-2xs transition-all cursor-pointer"
                  title="Save deductions for this consolidated bill"
                >
                  {isSavingDeductions ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : saveSuccess ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  <span>{saveSuccess ? 'Saved ✓' : 'Save'}</span>
                </button>
                <button
                  type="button"
                  className="text-emerald-700 p-0.5 hover:bg-emerald-100 rounded"
                >
                  {showDeductionsPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Warning if deductions exceed gross total */}
            {(supplierBill.deductions?.totalDeductions || 0) > (supplierBill.grossTotal || 0) && (
              <div className="mt-2 flex items-center gap-2 p-2 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Warning: Total deductions (₹{(supplierBill.deductions?.totalDeductions || 0).toLocaleString('en-IN')}) exceed gross purchase total (₹{(supplierBill.grossTotal || 0).toLocaleString('en-IN')})!
                </span>
              </div>
            )}

            {showDeductionsPanel && (
              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-emerald-200/60 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 mb-0.5">கமிஷன்</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={deductions.commission}
                    onChange={(e) => handleDeductionChange('commission', e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 mb-0.5">கேட்</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={deductions.gate}
                    onChange={(e) => handleDeductionChange('gate', e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 mb-0.5">கூலி</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={deductions.coolie}
                    onChange={(e) => handleDeductionChange('coolie', e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 mb-0.5">வாடகை</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={deductions.rent}
                    onChange={(e) => handleDeductionChange('rent', e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 mb-0.5">பற்று</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={deductions.debit}
                    onChange={(e) => handleDeductionChange('debit', e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-emerald-600"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Printable Content Area with Auto-Scaling for Mobile */}
        <div
          ref={scrollAreaRef}
          className="print-modal-scroll-area flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 bg-slate-100/80 rounded-xl my-3 sm:my-4 flex justify-center items-start"
        >
          <div
            className="print-bill-scaler"
            style={{
              width: previewScale < 1 ? `${baseWidthPx * previewScale}px` : 'auto',
              height: previewScale < 1 && baseHeightPx ? `${baseHeightPx * previewScale}px` : 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              overflow: 'visible'
            }}
          >
            <div
              className="print-bill-outer bg-white shadow-lg border border-slate-300 rounded-sm p-0"
              style={{
                width: `${baseWidthPx}px`,
                height: baseHeightPx ? `${baseHeightPx}px` : 'auto',
                transform: previewScale < 1 ? `scale(${previewScale})` : 'none',
                transformOrigin: 'top left',
                flexShrink: 0
              }}
            >
              {React.cloneElement(children, {
                printFormat,
                settings,
                transaction: isBuyerBill ? effectiveTransaction : undefined,
                purchase: isSupplierBill ? effectivePurchase : undefined
              })}
            </div>
          </div>
        </div>

        {/* Print instructions footer for the user */}
        <div className="no-print pt-2 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500">
          <span>
            {isBuyerBill
              ? 'Target: Canon G3030 series | Paper: Square 3.5"×3.5" (8.9 × 8.9 cm) | Single Page'
              : isSupplierBill
              ? 'Target: Canon G3030 series | Paper: A6 (105 × 148 mm) | Single Page'
              : 'Standard ledger statement.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
