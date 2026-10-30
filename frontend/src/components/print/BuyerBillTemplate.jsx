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
    : '25 A, காந்தி மார்க்கெட், திண்டுக்கல்-1';

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
      {/* Scoped Dynamic Print Page Style for strict 89mm x 89mm */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;700;800;900&display=swap');
        @media print {
          @page {
            size: 89mm 89mm;
            margin: 0mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 89mm !important;
            height: 89mm !important;
            max-height: 89mm !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      <div
        className="buyer-bill-page bg-white font-tamil text-black select-none"
        style={{
          width: '89mm',
          height: '89mm',
          maxWidth: '89mm',
          maxHeight: '89mm',
          padding: '5.5mm',
          boxSizing: 'border-box',
          overflow: 'hidden',
          color: '#034d28',
          lineHeight: 1.15,
          fontFamily: "'Mukta Malar', 'Noto Sans Tamil', sans-serif"
        }}
      >
        {/* Outer Green Border */}
        <div
          style={{
            border: '1.5px solid #034d28',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '0.8mm 1.2mm 0.8mm 1.2mm',
            overflow: 'hidden'
          }}
        >
          {/* Top Row: Auspicious symbol 'உ' & Phone numbers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            <div style={{ width: '30px' }} />
            <div style={{ textAlign: 'center', position: 'absolute', left: 0, right: 0, margin: '0 auto', top: '-1px' }}>
              <span
                style={{
                  fontSize: '8.5pt',
                  fontWeight: 900,
                  borderBottom: '1.5px double #034d28',
                  paddingBottom: '0.5px',
                  display: 'inline-block'
                }}
              >
                உ
              </span>
            </div>
            <div style={{ textAlign: 'right', fontSize: '6.2pt', fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.15 }}>
              <div>செல் : {phone1}</div>
              <div style={{ paddingLeft: '18px' }}>{phone2}</div>
            </div>
          </div>

          {/* Business Header with Lakshmi Logo */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '-1.5px' }}>
            {/* Logo */}
            <div style={{ width: '14mm', height: '16mm', flexShrink: 0, display: 'flex', alignItems: 'center', justifySelf: 'center' }}>
              <img
                src="/lakshmi-green.png"
                alt="Lakshmi Logo"
                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
              />
            </div>

            {/* Business Titles */}
            <div style={{ flex: 1, textAlign: 'center', paddingLeft: '1mm', paddingRight: '1mm' }}>
              <div
                style={{
                  fontSize: '13.5pt',
                  fontWeight: 900,
                  letterSpacing: '0.5px',
                  lineHeight: 1
                }}
              >
                மகாலட்சுமி
              </div>
              <div style={{ fontSize: '5.6pt', fontWeight: 800, marginTop: '1px', whiteSpace: 'nowrap' }}>
                தக்காளி &amp; காய், கனி கமிஷன் மண்டி
              </div>
              <div style={{ fontSize: '5pt', fontWeight: 700, marginTop: '0.8px', whiteSpace: 'nowrap' }}>
                {address}
              </div>
              <div style={{ fontSize: '6.8pt', fontWeight: 900, marginTop: '0.8px' }}>
                Prop : {owner}
              </div>
            </div>

            {/* Date block on right */}
            <div style={{ width: '22mm', flexShrink: 0, textAlign: 'right', alignSelf: 'flex-end', marginBottom: '1px', paddingRight: '1mm', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '6.2pt', fontWeight: 800 }}>
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
              fontSize: '9pt',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'baseline',
              marginTop: '0.8px',
              marginBottom: '1px'
            }}
          >
            <span style={{ whiteSpace: 'nowrap', marginRight: '4px' }}>திரு :</span>
            <span
              style={{
                flex: 1,
                fontStyle: 'italic',
                fontWeight: 900,
                fontSize: '11pt',
                color: '#02381e',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {transaction.buyerName || 'வாடிக்கையாளர்'}
            </span>
          </div>

          {/* 5-Column Table (No internal horizontal divider lines) */}
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
                gridTemplateColumns: '18% minmax(0, 39%) 11% 20% 12%',
                textAlign: 'center',
                fontSize: '7.2pt',
                fontWeight: 900,
                backgroundColor: '#ffffff',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ borderRight: '1px solid #034d28', padding: '1px 0', minWidth: 0, boxSizing: 'border-box' }}>விலை</div>
              <div style={{ borderRight: '1px solid #034d28', padding: '1px 0', minWidth: 0, boxSizing: 'border-box' }}>விபரம்</div>
              <div style={{ borderRight: '1px solid #034d28', padding: '1px 0', minWidth: 0, boxSizing: 'border-box' }}>No.</div>
              <div style={{ borderRight: '1px solid #034d28', padding: '1px 0', minWidth: 0, boxSizing: 'border-box' }}>ரூ.</div>
              <div style={{ padding: '1px 0', minWidth: 0, boxSizing: 'border-box' }}>பை.</div>
            </div>

            {/* Item Rows (Area 1: Enlarged Item Row Contents, No horizontal divider) */}
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
                    gridTemplateColumns: '18% minmax(0, 39%) 11% 20% 12%',
                    fontSize: '9.5pt',
                    lineHeight: 1.15,
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
                      fontSize: '11pt',
                      padding: '2px 1px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 0,
                      boxSizing: 'border-box'
                    }}
                  >
                    {rateVal}
                  </div>
                  <div style={{ borderRight: '1px solid #034d28', padding: '2px 2px', minWidth: 0, boxSizing: 'border-box' }}>
                    <div style={{ fontWeight: 900, fontSize: '8.6pt', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>{desc1}</div>
                    <div style={{ fontStyle: 'italic', fontSize: '7pt', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>{desc2}</div>
                  </div>
                  <div
                    style={{
                      borderRight: '1px solid #034d28',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontStyle: 'italic',
                      fontWeight: 900,
                      fontSize: '11.5pt',
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
                      fontSize: '11.5pt',
                      padding: '2px 2px',
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
                      fontSize: '9.5pt',
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
                  gridTemplateColumns: '18% minmax(0, 39%) 11% 20% 12%',
                  fontSize: '9.5pt',
                  lineHeight: 1.15,
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ borderRight: '1px solid #034d28', minWidth: 0, boxSizing: 'border-box' }} />
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    textAlign: 'right',
                    paddingRight: '3px',
                    fontWeight: 900,
                    fontSize: '8pt',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    minWidth: 0,
                    boxSizing: 'border-box'
                  }}
                >
                  மொத்த பில் :
                </div>
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 900,
                    fontSize: '11pt',
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
                    fontSize: '11.5pt',
                    padding: '2px 2px',
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
                    fontSize: '9.5pt',
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

            {/* Lower Accounting Summary Area (Row-by-row aligned grid) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                boxSizing: 'border-box'
              }}
            >
              {/* Row 1: பற்று / Old Balance */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '18% minmax(0, 39%) 11% 20% 12%',
                  flex: 1,
                  alignItems: 'center',
                  minHeight: 0,
                  boxSizing: 'border-box'
                }}
              >
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 2px',
                    fontSize: '6.8pt',
                    fontWeight: 900,
                    color: '#991b1b',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  பற்று
                </div>
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 2px',
                    fontSize: '6.5pt',
                    fontWeight: 700,
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
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0 2px',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    fontSize: '7.8pt',
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
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 700,
                    fontSize: '7.5pt',
                    boxSizing: 'border-box',
                    minWidth: 0
                  }}
                >
                  00
                </div>
              </div>

              {/* Row 2: மொத்தம் / Total Due */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '18% minmax(0, 39%) 11% 20% 12%',
                  flex: 1,
                  alignItems: 'center',
                  minHeight: 0,
                  boxSizing: 'border-box'
                }}
              >
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 2px',
                    fontSize: '6.8pt',
                    fontWeight: 900,
                    color: '#991b1b',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  மொத்தம்
                </div>
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 2px',
                    fontSize: '6.5pt',
                    fontWeight: 700,
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  : (பற்று + பில்)
                </div>
                <div style={{ borderRight: '1px solid #034d28', height: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0 2px',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 900,
                    fontSize: '7.8pt',
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
                    fontWeight: 700,
                    fontSize: '7.5pt',
                    boxSizing: 'border-box',
                    minWidth: 0
                  }}
                >
                  00
                </div>
              </div>

              {/* Row 3: செலுத்தியது / Amount Paid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '18% minmax(0, 39%) 11% 20% 12%',
                  flex: 1,
                  alignItems: 'center',
                  minHeight: 0,
                  boxSizing: 'border-box'
                }}
              >
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 1px',
                    fontSize: '6.2pt',
                    letterSpacing: '-0.2px',
                    fontWeight: 900,
                    color: '#991b1b',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  செலுத்தியது
                </div>
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 2px',
                    fontSize: '6.5pt',
                    fontWeight: 700,
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
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0 2px',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    fontSize: '7.8pt',
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
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 700,
                    fontSize: '7.5pt',
                    boxSizing: 'border-box',
                    minWidth: 0
                  }}
                >
                  00
                </div>
              </div>

              {/* Row 4: பாக்கி / Balance */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '18% minmax(0, 39%) 11% 20% 12%',
                  flex: 1,
                  alignItems: 'center',
                  minHeight: 0,
                  boxSizing: 'border-box'
                }}
              >
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 2px',
                    fontSize: '6.8pt',
                    fontWeight: 900,
                    color: '#991b1b',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isAdvance ? 'முன்பணம்' : 'பாக்கி'}
                </div>
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 2px',
                    fontSize: '6.5pt',
                    fontWeight: 700,
                    boxSizing: 'border-box',
                    minWidth: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                >
                  : {isAdvance ? '(முன்பணம்)' : '(மீதி பாக்கி)'}
                </div>
                <div style={{ borderRight: '1px solid #034d28', height: '100%', minWidth: 0, boxSizing: 'border-box' }} />
                <div
                  style={{
                    borderRight: '1px solid #034d28',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    padding: '0 2px',
                    fontFamily: 'monospace',
                    fontStyle: 'italic',
                    fontWeight: 900,
                    fontSize: '8.2pt',
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
                    fontWeight: 700,
                    fontSize: '7.5pt',
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
              fontSize: '7.5pt',
              letterSpacing: '0.5px',
              paddingTop: '0.6mm',
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
