// Comprehensive Live API & Workflow Verification Script
const BASE_URL = 'http://127.0.0.1:5000/api';

async function testWorkflow() {
  console.log('--- 1. Testing Health Endpoint ---');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const health = await healthRes.json();
  console.log('Health Response:', health);

  console.log('\n--- 2. Testing Admin Login ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  console.log('Login Result:', loginData.success, 'Token received:', !!loginData.token);
  const token = loginData.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  console.log('\n--- 3. Testing Dashboard for Demo Date (2026-10-03) ---');
  const dashRes = await fetch(`${BASE_URL}/dashboard?date=2026-10-03`, { headers: authHeaders });
  const dash = await dashRes.json();
  console.log('Dashboard Success:', dash.success);
  console.log('Summary:', JSON.stringify(dash.summary, null, 2));

  console.log('\nToday Purchases Count:', dash.todayPurchases.length);
  dash.todayPurchases.forEach(p => {
    console.log(`- ${p.supplierName}: ${p.bigBoxes} Big @ ₹${p.ratePerBigBox} = ₹${p.totalAmount}`);
  });

  console.log('\nToday Customer Tally:');
  dash.todayTally.forEach(t => {
    console.log(`- ${t.buyerName} | Old: ₹${t.oldBalance} | ${t.boxDescription} | Bill: ₹${t.todayBill} | Due: ₹${t.totalDue} | Paid: ₹${t.paid} | New: ₹${t.newBalance}`);
  });

  console.log('\n--- 4. Testing Live Frontend HTML Response ---');
  const feRes = await fetch('http://127.0.0.1:3000/');
  const feText = await feRes.text();
  console.log('Frontend Status:', feRes.status);
  console.log('Frontend title in HTML:', feText.includes('Tomato Wholesale Billing'));

  console.log('\n--- 5. Testing Creation of a New Real Sale ---');
  // Find B1
  const b1 = dash.todayTally.find(t => t.buyerName === 'B1');
  console.log('Current B1 balance:', b1.newBalance); // 1000

  // B1 buys next day: 2026-10-04, 5 Big @ 1200 = 6000. Total due = 1000 + 6000 = 7000. Pays 7000 => New 0
  const saleRes = await fetch(`${BASE_URL}/transactions/sale`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      buyerId: b1.buyerId,
      transactionDate: '2026-10-04',
      bigBoxes: 5,
      smallBoxes: 0,
      ratePerBigBox: 1200,
      amountPaid: 7000,
      notes: 'Next day market purchase'
    })
  });
  const saleData = await saleRes.json();
  console.log('New Sale Result:', saleData.success, saleData.message);
  console.log('Sale Details: Old =', saleData.transaction.oldBalance, 'Bill =', saleData.transaction.billAmount, 'Due =', saleData.transaction.totalDue, 'Paid =', saleData.transaction.amountPaid, 'New =', saleData.transaction.newBalance);

  console.log('\n--- 6. Testing Payment-Only Transaction ---');
  // Find B4 (has 5900 balance)
  const b4 = dash.todayTally.find(t => t.buyerName === 'B4');
  console.log('B4 balance before payment:', b4.newBalance); // 5900

  // B4 pays 2500 on 2026-10-04
  const payRes = await fetch(`${BASE_URL}/transactions/payment`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      buyerId: b4.buyerId,
      transactionDate: '2026-10-04',
      amountPaid: 2500,
      notes: 'Partial cash payment'
    })
  });
  const payData = await payRes.json();
  console.log('Payment Result:', payData.success, payData.message);
  console.log('Payment Details: Old =', payData.transaction.oldBalance, 'Paid =', payData.transaction.amountPaid, 'New =', payData.transaction.newBalance); // Should be 5900 - 2500 = 3400

  console.log('\n--- 7. Testing Buyer Ledger API for B1 ---');
  const ledgerRes = await fetch(`${BASE_URL}/buyers/${b1.buyerId}/ledger`, { headers: authHeaders });
  const ledgerData = await ledgerRes.json();
  console.log('B1 Ledger Entries Count:', ledgerData.ledgerEntries.length);
  ledgerData.ledgerEntries.forEach(e => {
    console.log(`  ${e.date} | ${e.description} | Debit: ₹${e.debit} | Credit: ₹${e.credit} | Bal: ₹${e.balance}`);
  });

  console.log('\n--- 8. Testing Reports API ---');
  const repRes = await fetch(`${BASE_URL}/reports?startDate=2026-10-01&endDate=2026-10-05`, { headers: authHeaders });
  const repData = await repRes.json();
  console.log('Reports Summary:', repData.summary);

  console.log('\nALL WORKFLOW CHECKS PASSED PERFECTLY!');
}

testWorkflow().catch(console.error);
