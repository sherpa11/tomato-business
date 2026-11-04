import test from 'node:test';
import assert from 'node:assert/strict';
import { roundMoney, calculateBigEquivalent } from '../src/services/ledgerService.js';

// Logic representing the daily total calculations in TodayTallyTable & Dashboard
function computeDailyTotals({ allTally, tally, isFiltered = false }) {
  const sourceList = (allTally && allTally.length > 0) ? allTally : (tally || []);
  let totalBig = 0;
  let totalSmall = 0;
  let totalBill = 0;
  let totalPaid = 0;

  sourceList.forEach((row) => {
    // Exclude voided transactions
    if (row.isVoid) return;

    if (row.type === 'SALE') {
      totalBig += Number(row.bigBoxes) || 0;
      totalSmall += Number(row.smallBoxes) || 0;
      totalBill += Number(row.todayBill ?? row.billAmount) || 0;
    }
    totalPaid += Number(row.paid ?? row.amountPaid) || 0;
  });

  const bigEquivalent = Math.round((totalBig + totalSmall / 2 + Number.EPSILON) * 10) / 10;

  let boxesText = '0 Boxes';
  if (totalBig > 0 && totalSmall > 0) {
    boxesText = `${totalBig} Big + ${totalSmall} Small (${bigEquivalent} Big Eqv)`;
  } else if (totalBig > 0) {
    boxesText = `${totalBig} Big ${totalBig === 1 ? 'Box' : 'Boxes'}`;
  } else if (totalSmall > 0) {
    boxesText = `${totalSmall} Small (${bigEquivalent} Big Eqv)`;
  }

  return {
    totalBig,
    totalSmall,
    bigEquivalent,
    boxesText,
    totalBill: roundMoney(totalBill),
    totalPaid: roundMoney(totalPaid)
  };
}

test('Customer Daily Tally Table Summary Row Calculations', async (t) => {
  await t.test('1. Accurately sums multiple sales, partial payments, and standalone payments', () => {
    const dayTransactions = [
      // Standalone payment
      { id: '1', buyerName: 'Jaya lakshmi', type: 'PAYMENT', bigBoxes: 0, smallBoxes: 0, todayBill: 0, paid: 3500, isVoid: false },
      // Standalone payment
      { id: '2', buyerName: 'Vadamadhurai Magesh', type: 'PAYMENT', bigBoxes: 0, smallBoxes: 0, todayBill: 0, paid: 2000, isVoid: false },
      // Standalone payment
      { id: '3', buyerName: 'Vadamathurai Dhanam', type: 'PAYMENT', bigBoxes: 0, smallBoxes: 0, todayBill: 0, paid: 4000, isVoid: false },
      // Standalone payment
      { id: '4', buyerName: 'Bala Hotel', type: 'PAYMENT', bigBoxes: 0, smallBoxes: 0, todayBill: 0, paid: 500, isVoid: false },
      // Standalone payment
      { id: '5', buyerName: 'Venu Biriyani', type: 'PAYMENT', bigBoxes: 0, smallBoxes: 0, todayBill: 0, paid: 2600, isVoid: false },
      // Standalone payment for Haribavan
      { id: '6', buyerName: 'Haribavan', type: 'PAYMENT', bigBoxes: 0, smallBoxes: 0, todayBill: 0, paid: 2000, isVoid: false },
      // Sale for Haribavan (3 Big boxes @ 400 = 1200, paid 0)
      { id: '7', buyerName: 'Haribavan', type: 'SALE', bigBoxes: 3, smallBoxes: 0, todayBill: 1200, paid: 0, isVoid: false }
    ];

    const totals = computeDailyTotals({ allTally: dayTransactions, tally: dayTransactions });
    assert.equal(totals.totalBig, 3);
    assert.equal(totals.totalSmall, 0);
    assert.equal(totals.bigEquivalent, 3);
    assert.equal(totals.boxesText, '3 Big Boxes');
    assert.equal(totals.totalBill, 1200);
    assert.equal(totals.totalPaid, 14600); // 3500 + 2000 + 4000 + 500 + 2600 + 2000 + 0
  });

  await t.test('2. Correctly handles Big Box and Small Box combinations with half-box equivalence', () => {
    const transactions = [
      { id: '1', buyerName: 'Buyer A', type: 'SALE', bigBoxes: 10, smallBoxes: 4, todayBill: 6000, paid: 2000, isVoid: false },
      { id: '2', buyerName: 'Buyer B', type: 'SALE', bigBoxes: 5, smallBoxes: 3, todayBill: 3250, paid: 3250, isVoid: false }
    ];

    const totals = computeDailyTotals({ allTally: transactions, tally: transactions });
    assert.equal(totals.totalBig, 15);
    assert.equal(totals.totalSmall, 7);
    // 15 + 7/2 = 18.5
    assert.equal(totals.bigEquivalent, 18.5);
    assert.equal(totals.boxesText, '15 Big + 7 Small (18.5 Big Eqv)');
    assert.equal(totals.totalBill, 9250);
    assert.equal(totals.totalPaid, 5250);
  });

  await t.test('3. Strictly excludes voided transactions from all three totals', () => {
    const transactions = [
      { id: '1', buyerName: 'Buyer A', type: 'SALE', bigBoxes: 10, smallBoxes: 0, todayBill: 5000, paid: 1000, isVoid: false },
      { id: '2', buyerName: 'Buyer B', type: 'SALE', bigBoxes: 20, smallBoxes: 0, todayBill: 10000, paid: 5000, isVoid: true, voidReason: 'Entered by mistake' },
      { id: '3', buyerName: 'Buyer C', type: 'PAYMENT', bigBoxes: 0, smallBoxes: 0, todayBill: 0, paid: 3000, isVoid: true, voidReason: 'Cancelled check' }
    ];

    const totals = computeDailyTotals({ allTally: transactions, tally: transactions });
    assert.equal(totals.totalBig, 10);
    assert.equal(totals.totalBill, 5000);
    assert.equal(totals.totalPaid, 1000);
  });

  await t.test('4. Preserves entire day totals when customer search filter is active', () => {
    const allTally = [
      { id: '1', buyerName: 'Haribavan', type: 'PAYMENT', bigBoxes: 0, smallBoxes: 0, todayBill: 0, paid: 2000, isVoid: false },
      { id: '2', buyerName: 'Haribavan', type: 'SALE', bigBoxes: 3, smallBoxes: 0, todayBill: 1200, paid: 0, isVoid: false },
      { id: '3', buyerName: 'Jaya lakshmi', type: 'PAYMENT', bigBoxes: 0, smallBoxes: 0, todayBill: 0, paid: 3500, isVoid: false }
    ];

    // User searched for "Haribavan", so filtered tally has only Haribavan rows
    const filteredTally = allTally.filter((row) => row.buyerName.includes('Haribavan'));
    assert.equal(filteredTally.length, 2);

    // Totals should still reflect allTally (entire day's business)
    const totals = computeDailyTotals({ allTally, tally: filteredTally, isFiltered: true });
    assert.equal(totals.totalBig, 3);
    assert.equal(totals.totalBill, 1200);
    assert.equal(totals.totalPaid, 5500); // 2000 + 0 + 3500
  });

  await t.test('5. No double-counting when a customer makes both a cash payment on sale and a standalone payment', () => {
    const allTally = [
      // Sale with cash received at time of sale
      { id: '1', buyerName: 'Kavitha', type: 'SALE', bigBoxes: 5, smallBoxes: 0, todayBill: 2500, paid: 1500, isVoid: false },
      // Later that day, customer pays another 1000 cash
      { id: '2', buyerName: 'Kavitha', type: 'PAYMENT', bigBoxes: 0, smallBoxes: 0, todayBill: 0, paid: 1000, isVoid: false }
    ];

    const totals = computeDailyTotals({ allTally, tally: allTally });
    assert.equal(totals.totalBig, 5);
    assert.equal(totals.totalBill, 2500);
    assert.equal(totals.totalPaid, 2500); // 1500 on sale + 1000 standalone = 2500 total
  });

  await t.test('6. Floating-point precision is preserved without rounding artifacts', () => {
    const transactions = [
      { id: '1', buyerName: 'Buyer 1', type: 'SALE', bigBoxes: 1, smallBoxes: 0, todayBill: 100.1, paid: 50.1, isVoid: false },
      { id: '2', buyerName: 'Buyer 2', type: 'SALE', bigBoxes: 1, smallBoxes: 0, todayBill: 200.2, paid: 100.2, isVoid: false }
    ];

    const totals = computeDailyTotals({ allTally: transactions, tally: transactions });
    assert.equal(totals.totalBill, 300.3);
    assert.equal(totals.totalPaid, 150.3);
  });
});
