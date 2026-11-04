import React from 'react';
import { formatDate } from '../../utils/formatters';

export default function BuyerBillTemplate({ transaction, settings }) {
  if (!transaction) return null;

  // Split phone numbers if available, or fallback to reference defaults
  const rawPhone = settings?.phone || '';
  const phones = rawPhone.split(/[,/|]+/).map((p) => p.trim()).filter(Boolean);
  const phone1 = phones[0] || '94434 01838';
  const phone2 = phones[1] || '99438 01838';

  const owner = settings?.ownerName && settings.ownerName !== 'Bootto' && settings.ownerName !== 'Proprietor'
    ? settings.ownerName
    : 'R. பூட்டோ';

  const address = settings?.address && !settings.address.toLowerCase().includes('mandi') && !settings.address.toLowerCase().includes('wholesale')
    ? settings.address
    : 'shop no : 25, Gandhi Market, Dindigul, 624001';

  // Normalize items array for consolidated bill (or single transaction fallback)
  let items = [];
  if (Array.isArray(transaction.items) && transaction.items.length > 0) {
    items = transaction.items;
  } else {
    const bigBoxes = Number(transaction.bigBoxes) || 0;
    const smallBoxes = Number(transaction.smallBoxes) || 0;
    let descLine1 = 'தக்காளி பெரிய பெட்டி';
    let descLine2 = '(Big Box)';
    let qtyText = bigBoxes > 0 ? `${bigBoxes}` : '—';
    let qtyNum = bigBoxes;

    if (bigBoxes > 0 && smallBoxes > 0) {
      descLine1 = 'தக்காளி பெட்டி';
      descLine2 = `(${bigBoxes} Big + ${smallBoxes} Small)`;
      qtyNum = Number(transaction.bigEquivalent) || (bigBoxes + smallBoxes / 2);
      qtyText = `${qtyNum}`;
    } else if (smallBoxes > 0 && bigBoxes === 0) {
      descLine1 = 'தக்காளி சிறிய பெட்டி';
      descLine2 = '(Small Box)';
      qtyNum = smallBoxes;
      qtyText = `${qtyNum}`;
    } else if (transaction.type === 'PAYMENT') {
      descLine1 = 'பணம் செலுத்தியது';
      descLine2 = '(Cash Receipt)';
      qtyText = '—';
      qtyNum = 0;
    }

    const rateNum = Number(transaction.ratePerBigBox) || 0;
    let lineAmt = 0;
    if (transaction.type === 'SALE' || !transaction.type) {
      if (rateNum > 0 && qtyNum > 0) {
        lineAmt = Math.round(rateNum * qtyNum * 100) / 100;
      } else {
        lineAmt = Number(transaction.billAmount) || Number(transaction.todayBill) || 0;
      }
    } else if (transaction.type === 'PAYMENT') {
      lineAmt = Number(transaction.amountPaid) || Number(transaction.paid) || 0;
    }

    items = [
      {
        ratePerBigBox: rateNum,
        bigBoxes,
        smallBoxes,
        bigEquivalent: qtyNum,
        lineAmount: lineAmt,
        billAmount: lineAmt,
        totalAmount: lineAmt,
        descLine1,
        descLine2,
        qtyText
      }
    ];
  }

  // Formula: ரூ. amount = விலை × எண்ணம் (No.)
  let billTotal = 0;
  if (transaction.todayBill !== undefined) {
    billTotal = Number(transaction.todayBill);
  } else if (transaction.billAmount !== undefined && transaction.type !== 'PAYMENT') {
    billTotal = Number(transaction.billAmount);
  } else {
    billTotal = items.reduce((sum, it) => sum + (Number(it.lineAmount !== undefined ? it.lineAmount : it.billAmount) || 0), 0);
  }

  const rupeesPart = Math.floor(billTotal).toLocaleString('en-IN');
  const paisePart = String(Math.round((billTotal % 1) * 100)).padStart(2, '0');

  // Total quantity for subtotal row
  const totalQty = items.reduce((sum, it) => sum + (Number(it.bigEquivalent || it.bigBoxes) || 0), 0);
  const totalQtyText = totalQty > 0 ? (Number.isInteger(totalQty) ? String(totalQty) : totalQty.toFixed(1)) : '—';

  // Accounting figures
  const oldBalNum = Number(transaction.oldBalance) || 0;
  const totalDueNum = Number(transaction.totalDue) !== undefined && !isNaN(Number(transaction.totalDue))
    ? Number(transaction.totalDue)
    : (oldBalNum + billTotal);
  const paidNum = Number(transaction.amountPaid) !== undefined ? Number(transaction.amountPaid) : (Number(transaction.paid) || 0);
  const newBalNum = Number(transaction.newBalance) !== undefined && !isNaN(Number(transaction.newBalance))
    ? Number(transaction.newBalance)
    : (totalDueNum - paidNum);

  const isAdvance = newBalNum < 0;

  return (
    <>
      {/* Scoped Dynamic Print Page Style for strict 105mm x 148mm (A6) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;700;800;900&display=swap');
        @media print {
          @page {
            size: 105mm 148mm;
            margin: 0mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 105mm !important;
            height: 148mm !important;
            max-height: 148mm !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
          .buyer-bill-page {
            padding: 5.2mm 4.5mm 4.8mm 4.5mm !important;
          }
          .outer-border {
            border: 1.5px solid #034d28 !important;
            border-top: 1.5px solid #034d28 !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      <div
        className="buyer-bill-page bg-white font-tamil text-black select-none"
        style={{
          width: '105mm',
          height: '148mm',
          maxWidth: '105mm',
          maxHeight: '148mm',
          padding: '5.2mm 4.5mm 4.8mm 4.5mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
          color: '#034d28',
          lineHeight: 1.2,
          fontFamily: "'Mukta Malar', 'Noto Sans Tamil', sans-serif"
        }}
      >
        {/* Outer Green Border */}
        <div
          className="outer-border"
          style={{
            border: '1.5px solid #034d28',
            borderTop: '1.5px solid #034d28',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1.5mm 2mm 1.5mm 2mm',
            overflow: 'hidden'
          }}
        >
          {/* Top Row: Auspicious symbol 'உ' & Phone numbers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            <div style={{ width: '40px' }} />
            <div style={{ textAlign: 'center', position: 'absolute', left: 0, right: 0, margin: '0 auto', top: '-1px' }}>
              <span
                style={{
                  fontSize: '10pt',
                  fontWeight: 900,
                  borderBottom: '1.5px double #034d28',
                  paddingBottom: '0.5px',
                  display: 'inline-block'
                }}
              >
                உ
              </span>
            </div>
            <div style={{ textAlign: 'right', fontSize: '7.5pt', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.2 }}>
              <div>செல் : {phone1}</div>
              <div style={{ paddingLeft: '18px' }}>{phone2}</div>
            </div>
          </div>

          {/* Business Header with Lakshmi Logo */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '-1px' }}>
            {/* Logo */}
            <div style={{ width: '18mm', height: '22mm', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="/lakshmi-green.png"
                alt="Lakshmi Logo"
                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
              />
            </div>

            {/* Business Titles */}
            <div style={{ flex: 1, minWidth: 0, textAlign: 'center', paddingLeft: '1mm', paddingRight: '1mm' }}>
              <div
                style={{
                  fontSize: '19pt',
                  fontWeight: 900,
                  letterSpacing: '0.5px',
                  lineHeight: 1
                }}
              >
                மகாலட்சுமி
              </div>
              <div style={{ fontSize: '8pt', fontWeight: 800, marginTop: '2px', whiteSpace: 'nowrap' }}>
                தக்காளி &amp; காய், கனி கமிஷன் மண்டி
              </div>
              <div style={{ fontSize: '7.2pt', fontWeight: 700, marginTop: '1.5px', whiteSpace: 'nowrap' }}>
                {address}
              </div>
              <div style={{ fontSize: '9.5pt', fontWeight: 900, marginTop: '1.5px' }}>
                Prop : {owner}
              </div>
            </div>

            {/* Date block on right */}
            <div style={{ width: '22mm', flexShrink: 0, textAlign: 'right', alignSelf: 'flex-end', marginBottom: '1px', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '7.5pt', fontWeight: 800 }}>
                தேதி :{' '}
                <span style={{ borderBottom: '1px dotted #034d28', paddingBottom: '0.5px', fontFamily: 'monospace', fontStyle: 'italic', fontWeight: 800 }}>
                  {formatDate(transaction.transactionDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Name Line */}
          <div
            style={{
              fontSize: '10.5pt',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'baseline',
              marginTop: '1.5px',
              marginBottom: '1.5mm'
            }}
          >
            <span style={{ whiteSpace: 'nowrap', marginRight: '4px' }}>திரு :</span>
            <span
              style={{
                flex: 1,
                fontStyle: 'italic',
                fontWeight: 900,
                fontSize: '13pt',
                color: '#02381e',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {transaction.buyerName || 'வாடிக்கையாளர்'}
            </span>
          </div>

          {/* 5-Column Table */}
          <div
            style={{
              border: '1px solid #034d28',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '16% minmax(0, 44%) 10% 20% 10%',
                textAlign: 'center',
                fontSize: '8.5pt',
                fontWeight: 900,
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
                borderBottom: '1px solid #034d28'
              }}
            >
              <div style={{ borderRight: '1px solid #034d28', padding: '2px 0', minWidth: 0, boxSizing: 'border-box' }}>விலை</div>
              <div style={{ borderRight: '1px solid #034d28', padding: '2px 0', minWidth: 0, boxSizing: 'border-box' }}>விபரம்</div>
              <div style={{ borderRight: '1px solid #034d28', padding: '2px 0', minWidth: 0, boxSizing: 'border-box' }}>No.</div>
              <div style={{ borderRight: '1px solid #034d28', padding: '2px 0', minWidth: 0, boxSizing: 'border-box' }}>ரூ.</div>
              <div style={{ padding: '2px 0', minWidth: 0, boxSizing: 'border-box' }}>பை.</div>
            </div>

            {/* Item Rows */}
            {items.map((item, idx) => {
              const rateNum = Number(item.ratePerBigBox) || 0;
              const rateVal = rateNum > 0 ? rateNum.toLocaleString('en-IN') : (item.ratePerBigBox ? String(item.ratePerBigBox) : '—');
              const lineAmt = Number(item.lineAmount !== undefined ? item.lineAmount : item.billAmount) || 0;
              const lineRupees = Math.floor(lineAmt).toLocaleString('en-IN');
              const linePaise = String(Math.round((lineAmt % 1) * 100)).padStart(2, '0');
              const desc1 = item.descLine1 || 'தக்காளி பெரிய பெட்டி';
              const desc2 = item.descLine2 || '(Big Box)';
              const qty = item.qtyText || (item.bigBoxes > 0 ? `${item.bigBoxes}` : '—');

              return (
                <div
                  key={item._id || idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '16% minmax(0, 44%) 10% 20% 10%',
                    fontSize: '10.5pt',
                    lineHeight: 1.2,
                    boxSizing: 'border-box'
                  }}
                >
                  <div
                    style={{
                      borderRight: '1px solid #034d28',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontStyle: 'italic',
                      fontWeight: 900,
                      fontSize: '12.5pt',
                      padding: '3px 1px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 0,
                      boxSizing: 'border-box'
                    }}
                  >
                    {rateVal}
                  </div>
                  <div style={{ borderRight: '1px solid #034d28', padding: '2px 4px', minWidth: 0, boxSizing: 'border-box' }}>
                    <div style={{ fontWeight: 900, fontSize: '9.8pt', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>{desc1}</div>
                    <div style={{ fontStyle: 'italic', fontSize: '8.2pt', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>{desc2}</div>
                  </div>
                  <div
                    style={{
                      borderRight: '1px solid #034d28',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontStyle: 'italic',
                      fontWeight: 900,
                      fontSize: '13pt',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 0,
                      boxSizing: 'border-box'
                    }}
                  >
                    {qty}
                  </div>
                  <div
                    style={{
                      borderRight: '1px solid #034d28',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontStyle: 'italic',
                      fontWeight: 900,
                      fontSize: '13pt',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      minWidth: 0,
                      boxSizing: 'border-box'
                    }}
                  >
                    {lineRupees}
                  </div>
                  <div
                    style={{
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontStyle: 'italic',
                      fontWeight: 800,
                      fontSize: '11pt',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 0,
                      boxSizing: 'border-box'
                    }}
                  >
                    {linePaise}
                  </div>
                </div>
              );
            })}

            {/* Optional Subtotal Row for multiple sales entries */}
            {items.length > 1 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '16% minmax(0, 44%) 10% 20% 10%',
                  fontSize: '9.5pt',
                  lineHeight: 1.2,
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ borderRight: '1px solid #034d28', minWidth: 0, boxSizing: 'border-box' }} />
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    textAlign: 'right',
                    paddingRight: '4px',
                    fontWeight: 900,
                    fontSize: '9.5pt',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}
                >
                  மொத்தம் :
                </div>
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 900,
                    fontSize: '12.5pt',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}
                >
                  {totalQtyText}
                </div>
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 900,
                    fontSize: '13pt',
                    padding: '2px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}
                >
                  {rupeesPart}
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    fontSize: '11pt',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}
                >
                  {paisePart}
                </div>
              </div>
            )}

            {/* Middle Space with vertical dividers only */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '16% minmax(0, 44%) 10% 20% 10%',
                flex: 1,
                minHeight: '12mm',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ borderRight: '1px solid #034d28', minWidth: 0 }} />
              <div style={{ borderRight: '1px solid #034d28', minWidth: 0 }} />
              <div style={{ borderRight: '1px solid #034d28', minWidth: 0 }} />
              <div style={{ borderRight: '1px solid #034d28', minWidth: 0 }} />
              <div style={{ minWidth: 0 }} />
            </div>

            {/* Lower Accounting Summary Area (Row-by-row aligned grid) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                boxSizing: 'border-box',
                borderTop: '1px solid #034d28'
              }}
            >
              {/* Row 1: முந்தைய பாக்கி */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '16% minmax(0, 44%) 10% 20% 10%',
                  height: '6.8mm',
                  alignItems: 'center',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ borderRight: '1px solid #034d28', height: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 4px',
                    fontSize: '8.2pt',
                    fontWeight: 800,
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  : (முந்தைய பாக்கி)
                </div>
                <div style={{ borderRight: '1px solid #034d28', height: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    borderBottom: '0.75pt solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0 4px',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    fontSize: '9.2pt',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  {oldBalNum.toLocaleString('en-IN')}
                </div>
                <div
                  style={{
                    borderBottom: '0.75pt solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    fontSize: '8.5pt',
                    boxSizing: 'border-box',
                    minWidth: 0
                  }}
                >
                  00
                </div>
              </div>

              {/* Row 2: Total due */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '16% minmax(0, 44%) 10% 20% 10%',
                  height: '6.8mm',
                  alignItems: 'center',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ borderRight: '1px solid #034d28', height: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <div style={{ borderRight: '1px solid #034d28', height: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <div style={{ borderRight: '1px solid #034d28', height: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0 4px',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 900,
                    fontSize: '9.2pt',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  {totalDueNum.toLocaleString('en-IN')}
                </div>
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    fontSize: '8.5pt',
                    boxSizing: 'border-box',
                    minWidth: 0
                  }}
                >
                  00
                </div>
              </div>

              {/* Row 3: வரவு */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '16% minmax(0, 44%) 10% 20% 10%',
                  height: '6.8mm',
                  alignItems: 'center',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ borderRight: '1px solid #034d28', height: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 4px',
                    fontSize: '8.2pt',
                    fontWeight: 800,
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  : (வரவு)
                </div>
                <div style={{ borderRight: '1px solid #034d28', height: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    borderBottom: '0.75pt solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0 4px',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    fontSize: '9.2pt',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  {paidNum.toLocaleString('en-IN')}
                </div>
                <div
                  style={{
                    borderBottom: '0.75pt solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    fontSize: '8.5pt',
                    boxSizing: 'border-box',
                    minWidth: 0
                  }}
                >
                  00
                </div>
              </div>

              {/* Row 4: பாக்கி */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '16% minmax(0, 44%) 10% 20% 10%',
                  height: '7.2mm',
                  alignItems: 'center',
                  boxSizing: 'border-box'
                }}
              >
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 4px',
                    fontSize: '12pt',
                    fontWeight: 900,
                    color: '#991b1b',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isAdvance ? 'முன்பணம்' : 'பாக்கி'}
                </div>
                <div style={{ borderRight: '1px solid #034d28', height: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <div style={{ borderRight: '1px solid #034d28', height: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0 4px',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 900,
                    fontSize: '13.5pt',
                    color: '#991b1b',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  {Math.abs(newBalNum).toLocaleString('en-IN')}
                </div>
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    fontSize: '11pt',
                    boxSizing: 'border-box',
                    minWidth: 0
                  }}
                >
                  00
                </div>
              </div>
            </div>
          </div>

          {/* Centered Footer */}
          <div
            style={{
              textAlign: 'center',
              fontWeight: 900,
              fontSize: '9.5pt',
              letterSpacing: '0.5px',
              paddingTop: '1.5mm',
              lineHeight: 1
            }}
          >
            நன்றி மீண்டும் வருக !
          </div>
        </div>
      </div>
    </>
  );
}
