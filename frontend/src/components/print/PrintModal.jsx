import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, CheckCircle2, Loader2, ChevronDown, ChevronUp, Download, Monitor, ImageDown, Save, AlertTriangle } from 'lucide-react';
import { toBlob, toPng } from 'html-to-image';
import { useSettings } from '../../context/SettingsContext';
import { printAPI, purchasesAPI, transactionsAPI } from '../../api/client';
import { roundMoney } from '../../utils/formatters';

export default function PrintModal({ isOpen, onClose, title = 'Print Preview', children }) {
  const { settings } = useSettings();
  const [printFormat, setPrintFormat] = useState(settings?.thermalPrintWidth || '80mm');

  // Print service states
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [printMessage, setPrintMessage] = useState('');
  const [printerInfo, setPrinterInfo] = useState({ hasCanon: true, defaultPrinter: 'Canon G3030 series' });
  const [showOptions, setShowOptions] = useState(false);

  // Paper size state for Buyer Bill (Option 1: 'square' default 89x89 mm, Option 2: 'a6' 105x148 mm)
  const [buyerPaperSize, setBuyerPaperSize] = useState('square');
  const [showPaperSizeDropdown, setShowPaperSizeDropdown] = useState(false);
  const paperDropdownRef = React.useRef(null);

  // Determine what type of document is being printed
  const isStatement = Boolean(children?.props?.ledgerEntries) || title.toLowerCase().includes('statement') || title.toLowerCase().includes('ledger');
  const isBuyerBill = !isStatement && (title.toLowerCase().includes('buyer') || Boolean(children?.props?.transaction));
  const isSupplierBill = !isStatement && (title.toLowerCase().includes('supplier') || Boolean(children?.props?.purchase));

  // Exact unscaled dimensions in screen pixels (at standard 96 DPI: 1 inch = 25.4mm)
  // A4 (210mm x 297mm): 210mm = 793.7px; 297mm = 1122.5px
  // Square (89mm x 89mm): 89mm = 336.38px; 89mm = 336.38px
  // A6 (105mm x 148mm): 105mm = 396.85px; 148mm = 559.37px
  let baseWidthPx = 396.85;
  let baseHeightPx = 559.37;

  if (isStatement) {
    baseWidthPx = 794;
    baseHeightPx = null;
  } else if (isBuyerBill) {
    if (buyerPaperSize === 'a6') {
      baseWidthPx = 396.85;
      baseHeightPx = 559.37;
    } else {
      baseWidthPx = 336.38;
      baseHeightPx = 336.38;
    }
  } else if (isSupplierBill) {
    baseWidthPx = 396.85;
    baseHeightPx = 559.37;
  } else {
    baseWidthPx = 794;
    baseHeightPx = null;
  }

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

  // Manage body classes, paper size, and dynamic @page style on modal open/change
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('print-modal-active');
      if (isStatement) {
        document.body.classList.add('paper-a4');
        document.body.classList.remove('paper-square', 'paper-a6');
      } else {
        const isSquare = isBuyerBill && buyerPaperSize === 'square';
        if (isSquare) {
          document.body.classList.add('paper-square');
          document.body.classList.remove('paper-a6', 'paper-a4');
        } else {
          document.body.classList.add('paper-a6');
          document.body.classList.remove('paper-square', 'paper-a4');
        }
      }

      // Dynamically inject top-level @page rule into document.head so browser print knows exact paper dimensions
      let styleEl = document.getElementById('dynamic-print-paper-size');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dynamic-print-paper-size';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        @page {
          size: ${isStatement ? 'A4 portrait' : (isBuyerBill && buyerPaperSize === 'square' ? '89mm 89mm' : '105mm 148mm')};
          margin: ${isStatement ? '10mm 10mm 12mm 10mm' : '0mm'};
        }
      `;

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
      document.body.classList.remove('print-modal-active', 'paper-square', 'paper-a6', 'paper-a4');
      const styleEl = document.getElementById('dynamic-print-paper-size');
      if (styleEl) {
        try { styleEl.remove(); } catch {}
      }
      setIsPrinting(false);
      setPrintSuccess(false);
      setPrintMessage('');
      setShowOptions(false);
      setShowPaperSizeDropdown(false);
    }
    return () => {
      document.body.classList.remove('print-modal-active', 'paper-square', 'paper-a6', 'paper-a4');
      const styleEl = document.getElementById('dynamic-print-paper-size');
      if (styleEl) {
        try { styleEl.remove(); } catch {}
      }
    };
  }, [isOpen, isStatement, isBuyerBill, buyerPaperSize]);

  // Click outside listener for paper size selector dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (paperDropdownRef.current && !paperDropdownRef.current.contains(e.target)) {
        setShowPaperSizeDropdown(false);
      }
    };
    if (showPaperSizeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPaperSizeDropdown]);

  const rawTransaction = children?.props?.transaction;
  const rawPurchase = children?.props?.purchase;
  const type = isBuyerBill ? 'buyer' : isSupplierBill ? 'supplier' : 'buyer';

  // Helper to construct an immediate synchronous bill from raw transaction
  const buildImmediateBuyerBill = useCallback((t) => {
    if (!t) return null;
    if (t.items && t.items.length > 0) {
      const mappedItems = t.items.map((it) => {
        const big = Number(it.bigBoxes) || 0;
        const small = Number(it.smallBoxes) || 0;
        const bigEq = Number(it.bigEquivalent) || (big + small / 2);
        const rate = Number(it.ratePerBigBox) || 0;
        const lineAmt = Number(it.lineAmount) !== undefined && !isNaN(Number(it.lineAmount))
          ? Number(it.lineAmount)
          : (Number(it.billAmount) || Math.round(bigEq * rate * 100) / 100);
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
          ...it,
          ratePerBigBox: rate,
          bigBoxes: big,
          smallBoxes: small,
          bigEquivalent: bigEq,
          lineAmount: lineAmt,
          billAmount: lineAmt,
          descLine1: it.descLine1 || descLine1,
          descLine2: it.descLine2 || descLine2,
          qtyText: it.qtyText || (big > 0 && small === 0 ? `${big}` : `${bigEq}`)
        };
      });
      return {
        ...t,
        items: mappedItems
      };
    }
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

    const effectiveOldBal = Number(t.oldBalance) || 0;
    const effectiveTotalDue = Number(t.totalDue) !== undefined && !isNaN(Number(t.totalDue))
      ? Number(t.totalDue)
      : (effectiveOldBal + (t.type === 'SALE' || !t.type ? lineAmt : 0));
    const effectivePaid = Number(t.amountPaid) !== undefined ? Number(t.amountPaid) : (Number(t.paid) || Number(t.credit) || 0);
    const effectiveNewBal = Number(t.newBalance) !== undefined && !isNaN(Number(t.newBalance))
      ? Number(t.newBalance)
      : (Number(t.balance) !== undefined && !isNaN(Number(t.balance))
        ? Number(t.balance)
        : (effectiveTotalDue - effectivePaid));

    return {
      _id: t._id || t.transactionId || t.id,
      buyerId: t.buyerId?._id || t.buyerId,
      buyerName: t.buyerName,
      transactionDate: t.transactionDate || t.date,
      todayBill: lineAmt,
      billAmount: lineAmt,
      oldBalance: effectiveOldBal,
      totalDue: effectiveTotalDue,
      amountPaid: effectivePaid,
      paid: effectivePaid,
      newBalance: effectiveNewBal,
      balance: effectiveNewBal,
      items: [
        {
          _id: t._id || t.transactionId || t.id,
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
        const txDate = rawTransaction.transactionDate || rawTransaction.date;
        const txId = rawTransaction._id || rawTransaction.transactionId || rawTransaction.id;
        if (!buyerIdVal && !txId) return;

        const res = await transactionsAPI.getConsolidated({
          buyerId: buyerIdVal,
          transactionDate: txDate,
          transactionId: txId
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

  // 1. Browser Print (Using isolated iframe for exact dimensions in Chrome preview + window fallback)
  const handleBrowserPrint = async () => {
    if (isSupplierBill && deductionsModified) {
      await handleSaveDeductions();
    }
    setShowOptions(false);
    const origTitle = document.title;
    const title = isStatement
      ? 'Customer_Statement_A4'
      : isBuyerBill
      ? (buyerPaperSize === 'a6' ? 'Buyer_Bill_A6' : 'Buyer_Bill_Square')
      : isSupplierBill
      ? 'Supplier_Bill_A6'
      : 'Customer_Statement';
    document.title = title;

    if (isStatement) {
      window.print();
      setTimeout(() => {
        document.title = origTitle;
      }, 1500);
      return;
    }

    const isSquare = isBuyerBill && buyerPaperSize === 'square';
    const paperW = isSquare ? '89mm' : '105mm';
    const paperH = isSquare ? '89mm' : '148mm';

    // Try isolated hidden iframe for cleanest print preview matching physical paper
    try {
      const printableOuter = document.querySelector('.print-bill-outer');
      const billNode = printableOuter?.querySelector('.buyer-bill-page, .supplier-bill-page');
      if (!billNode) throw new Error('Printable element not found');

      let iframe = document.getElementById('print-paper-frame');
      if (iframe) {
        try { iframe.remove(); } catch {}
      }
      iframe = document.createElement('iframe');
      iframe.id = 'print-paper-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: ${paperW} ${paperH};
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${paperW} !important;
      height: ${paperH} !important;
      max-height: ${paperH} !important;
      overflow: hidden !important;
      background: #ffffff !important;
      font-family: 'Mukta Malar', 'Noto Sans Tamil', sans-serif;
      color: #034d28;
    }
    .buyer-bill-page, .supplier-bill-page {
      width: ${paperW} !important;
      height: ${paperH} !important;
      max-width: ${paperW} !important;
      max-height: ${paperH} !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      overflow: hidden !important;
    }
    .outer-border {
      box-sizing: border-box !important;
    }
  </style>
</head>
<body>
  ${billNode.outerHTML}
</body>
</html>`);
      doc.close();

      const triggerPrint = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (printErr) {
          console.warn('[PrintModal] iframe print failed, falling back to window.print:', printErr);
          window.print();
        }
      };

      if (iframe.contentWindow.document.readyState === 'complete') {
        setTimeout(triggerPrint, 200);
      } else {
        iframe.contentWindow.onload = () => setTimeout(triggerPrint, 200);
      }
    } catch (e) {
      console.warn('[PrintModal] Falling back to standard window.print():', e);
      window.print();
    } finally {
      setTimeout(() => {
        document.title = origTitle;
      }, 1500);
    }
  };

  // 2. Direct Print to Canon G3030
  const handleDirectPrint = async () => {
    setShowOptions(false);
    if (isStatement || (!effectiveTransaction && !effectivePurchase)) {
      handleBrowserPrint();
      return;
    }

    if (isSupplierBill && deductionsModified) {
      await handleSaveDeductions();
    }

    setIsPrinting(true);
    setPrintMessage('Sending to Canon G3030...');

    try {
      const res = await printAPI.directPrint({
        type,
        transaction: effectiveTransaction,
        purchase: effectivePurchase,
        paperSize: isBuyerBill ? buyerPaperSize : 'a6',
        printerName: printerInfo.defaultPrinter || 'Canon G3030 series',
        openDialog: false,
        silent: true
      });

      if (res?.success) {
        setPrintSuccess(true);
        setPrintMessage(`Printed to ${res.printer || 'Canon G3030'}`);
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

  // 3. One-Click Download Bill Image (High-Resolution PNG)
  const handleDownloadImage = async () => {
    setShowOptions(false);
    if (isSupplierBill && deductionsModified) {
      await handleSaveDeductions();
    }

    setIsDownloadingImage(true);
    setPrintMessage('Exporting bill image...');

    let exportContainer = null;
    try {
      // Find printable bill element
      const billNode = document.querySelector(
        '.print-bill-outer .buyer-bill-page, .print-bill-outer .supplier-bill-page, .print-bill-outer .print-container'
      );
      if (!billNode) {
        throw new Error('Bill content element not found');
      }

      // Exact unscaled dimensions in screen pixels (96 DPI: 1 inch = 25.4mm)
      // Square (89mm x 89mm): 336.38px; A6 (105mm x 148mm): 396.85px x 559.37px; A4 Statement: 794px
      let targetWidthPx = 336.38;
      let targetHeightPx = 336.38;

      if (isStatement) {
        targetWidthPx = 794;
        targetHeightPx = billNode.offsetHeight || null;
      } else if (isBuyerBill) {
        if (buyerPaperSize === 'a6') {
          targetWidthPx = 396.85;
          targetHeightPx = 559.37;
        } else {
          targetWidthPx = 336.38;
          targetHeightPx = 336.38;
        }
      } else if (isSupplierBill) {
        targetWidthPx = 396.85;
        targetHeightPx = 559.37;
      }

      // Create an unscaled off-screen export container to isolate from modal zoom/scale
      exportContainer = document.createElement('div');
      exportContainer.style.position = 'fixed';
      exportContainer.style.left = '-99999px';
      exportContainer.style.top = '0';
      exportContainer.style.width = `${targetWidthPx}px`;
      exportContainer.style.height = targetHeightPx ? `${targetHeightPx}px` : 'auto';
      exportContainer.style.margin = '0';
      exportContainer.style.padding = '0';
      exportContainer.style.overflow = 'hidden';
      exportContainer.style.background = '#ffffff';
      exportContainer.style.zIndex = '-9999';
      exportContainer.style.transform = 'none';

      const clone = billNode.cloneNode(true);
      clone.style.transform = 'none';
      clone.style.margin = '0';
      clone.style.width = `${targetWidthPx}px`;
      if (targetHeightPx) {
        clone.style.height = `${targetHeightPx}px`;
        clone.style.maxHeight = `${targetHeightPx}px`;
      }

      exportContainer.appendChild(clone);
      document.body.appendChild(exportContainer);

      // Wait for Tamil fonts (Mukta Malar / Noto Sans Tamil) to finish loading
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {}
      }

      // Ensure all images (e.g. Lakshmi logo) in the cloned bill are fully loaded
      const imgElements = Array.from(clone.querySelectorAll('img'));
      await Promise.all(
        imgElements.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 300);
          });
        })
      );

      // Brief tick for font rendering and layout stability
      await new Promise((r) => setTimeout(r, 60));

      // Generate high-resolution (3x) PNG blob
      let blob = null;
      try {
        blob = await toBlob(clone, {
          pixelRatio: 3,
          width: targetWidthPx,
          height: targetHeightPx || clone.offsetHeight,
          backgroundColor: '#ffffff',
          cacheBust: false
        });
      } catch (blobErr) {
        console.warn('[PrintModal] toBlob direct capture fallback to toPng:', blobErr);
        const dataUrl = await toPng(clone, {
          pixelRatio: 3,
          width: targetWidthPx,
          height: targetHeightPx || clone.offsetHeight,
          backgroundColor: '#ffffff'
        });
        const resp = await fetch(dataUrl);
        blob = await resp.blob();
      }

      if (!blob) {
        throw new Error('Image generation produced empty blob');
      }

      // Generate meaningful filename (e.g. Buyer_Bill_AM_2026-11-17.png)
      const buyerName = effectiveTransaction?.buyerName || children?.props?.buyer?.name || 'Customer';
      const safeBuyerName = buyerName
        .trim()
        .replace(/[\/\s]+/g, '_')
        .replace(/[^a-zA-Z0-9_\-\u0B80-\u0BFF]/g, '');

      const rawDate = effectiveTransaction?.transactionDate || effectiveTransaction?.date;
      let dateStr = '';
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          dateStr = d.toISOString().slice(0, 10);
        }
      }
      if (!dateStr) {
        dateStr = new Date().toISOString().slice(0, 10);
      }

      const filename = isBuyerBill
        ? `Buyer_Bill_${safeBuyerName || 'Customer'}_${dateStr}.png`
        : isSupplierBill
        ? `Supplier_Bill_${(effectivePurchase?.supplierName || 'Supplier').trim().replace(/[\/\s]+/g, '_')}_${dateStr}.png`
        : `Customer_Statement_${safeBuyerName || 'Customer'}_${dateStr}.png`;

      // Device-Specific Download Behaviour:
      // Mobile (Android / iOS): Use Web Share API if supported for direct Save to Photos/Gallery
      const file = new File([blob], filename, { type: 'image/png' });
      const canShare = typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      let shared = false;
      if (canShare) {
        try {
          await navigator.share({
            files: [file],
            title: filename.replace('.png', ''),
            text: `${effectiveTransaction?.buyerName || 'Buyer'} Bill`
          });
          shared = true;
          setPrintMessage('Bill image ready to save or share!');
          setTimeout(() => setPrintMessage(''), 4000);
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') {
            // User cancelled the share dialog
            setPrintMessage('');
            return;
          }
          console.warn('[PrintModal] Share API error, falling back to download:', shareErr);
        }
      }

      if (!shared) {
        // Desktop / Laptop & standard mobile download fallback
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 2000);

        setPrintMessage('Bill image downloaded!');
        setTimeout(() => setPrintMessage(''), 4000);
      }
    } catch (err) {
      console.error('[PrintModal] Download image failed:', err);
      setPrintMessage('Failed to download bill image');
      setTimeout(() => setPrintMessage(''), 4000);
    } finally {
      if (exportContainer && exportContainer.parentNode) {
        exportContainer.parentNode.removeChild(exportContainer);
      }
      setIsDownloadingImage(false);
    }
  };

  // 4. Download verified 1-page PDF
  const handleDownloadPdf = async () => {
    setShowOptions(false);
    if (isSupplierBill && deductionsModified) {
      await handleSaveDeductions();
    }
    try {
      const blob = await printAPI.streamPdf({
        type,
        transaction: effectiveTransaction,
        purchase: effectivePurchase,
        paperSize: isBuyerBill ? buyerPaperSize : 'a6'
      });
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        isBuyerBill
          ? (buyerPaperSize === 'a6' ? 'Buyer_Bill_A6.pdf' : 'Buyer_Bill_Square.pdf')
          : 'Supplier_Bill_A6.pdf'
      );
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
      <div className={`print-modal-container bg-white rounded-t-3xl sm:rounded-2xl ${isStatement ? 'max-w-4xl' : 'max-w-2xl'} w-full p-3 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[96vh] sm:max-h-[94vh] flex flex-col`}>
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
                {isStatement
                  ? 'Paper size: A4 Sheet (210mm × 297mm) • Customer Statement Ledger'
                  : isBuyerBill
                  ? buyerPaperSize === 'a6'
                    ? 'Paper size: 105mm × 148mm (A6 Mandi Bill)'
                    : 'Paper size: 89mm × 89mm (Square Mandi Bill)'
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

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3">
            {/* Paper Size Indicator / Format Toggle */}
            {isStatement ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 xs:px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>A4 Sheet (210 × 297 mm)</span>
              </span>
            ) : isBuyerBill ? (
              <div className="relative" ref={paperDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowPaperSizeDropdown(!showPaperSizeDropdown)}
                  className="inline-flex items-center gap-1 xs:gap-1.5 px-2 xs:px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/80 active:scale-95 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Select Paper Size"
                  aria-label="Select Paper Size"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{buyerPaperSize === 'a6' ? 'A6 (105×148)' : 'Square (89×89)'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-emerald-700 transition-transform ${showPaperSizeDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showPaperSizeDropdown && (
                  <div
                    className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-emerald-200 py-1.5 z-50 animate-in fade-in zoom-in-95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-900/60 border-b border-emerald-100">
                      Buyer Bill Paper Size
                    </div>

                    {/* Option 1: Square (Default) */}
                    <button
                      type="button"
                      onClick={() => {
                        setBuyerPaperSize('square');
                        setShowPaperSizeDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        buyerPaperSize === 'square'
                          ? 'bg-emerald-50 text-emerald-900 font-extrabold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>Square (Default)</span>
                        <span className="text-[10px] font-normal text-slate-500">89 × 89 mm • Square</span>
                      </div>
                      {buyerPaperSize === 'square' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>

                    {/* Option 2: A6 */}
                    <button
                      type="button"
                      onClick={() => {
                        setBuyerPaperSize('a6');
                        setShowPaperSizeDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        buyerPaperSize === 'a6'
                          ? 'bg-emerald-50 text-emerald-900 font-extrabold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>A6 Mandi Bill</span>
                        <span className="text-[10px] font-normal text-slate-500">105 × 148 mm • Portrait</span>
                      </div>
                      {buyerPaperSize === 'a6' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : isSupplierBill ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 xs:px-3 py-1.5 bg-red-50 text-red-800 border border-red-200 rounded-lg text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-red-600" />
                <span>A6 (105 × 148 mm)</span>
              </span>
            ) : (
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPrintFormat('80mm')}
                  className={`px-2 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    printFormat === '80mm' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-600'
                  }`}
                >
                  Thermal (80mm)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('A4')}
                  className={`px-2 sm:px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
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
                className={`flex items-center justify-center gap-1.5 xs:gap-2 px-3 xs:px-4 h-10 sm:h-9 text-white rounded-l-xl text-xs xs:text-sm font-bold cursor-pointer active:scale-95 transition-all ${
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
                    : isStatement
                    ? 'Print Statement'
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
                  {/* 1. Direct to Canon G3030 */}
                  <button
                    onClick={() => handleDirectPrint()}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div>Direct to Canon G3030</div>
                      <div className="text-[10px] text-slate-400 font-normal">1-click direct USB printing</div>
                    </div>
                  </button>

                  {/* 2. Browser Print Preview */}
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

                  {/* 3. Download Bill Image */}
                  <button
                    onClick={handleDownloadImage}
                    disabled={isDownloadingImage}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                  >
                    {isDownloadingImage ? (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    ) : (
                      <ImageDown className="w-4 h-4 text-blue-600" />
                    )}
                    <div>
                      <div>Download Bill Image</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {isDownloadingImage ? 'Generating PNG...' : 'High-resolution PNG'}
                      </div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  {/* 4. Download 1-Page PDF */}
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
                paperSize: isBuyerBill ? buyerPaperSize : undefined,
                transaction: isBuyerBill ? effectiveTransaction : undefined,
                purchase: isSupplierBill ? effectivePurchase : undefined
              })}
            </div>
          </div>
        </div>

        {/* Print instructions footer for the user */}
        <div className="no-print pt-2 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500">
          <span>
            {isStatement
              ? 'Target: Standard Printer | Paper: A4 Sheet (210 × 297 mm) | Full Statement'
              : isBuyerBill
              ? buyerPaperSize === 'a6'
                ? 'Target: Canon G3030 series | Paper: A6 (105 × 148 mm) | Single Page'
                : 'Target: Canon G3030 series | Paper: Square (89 × 89 mm) | Single Page'
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
