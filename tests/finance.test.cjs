const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTotals, calculateMemberBalances, settle, vietnamDate } = require('../finance.js');
const members = [{ user_id: 'a', name: 'A' }, { user_id: 'b', name: 'B' }, { user_id: 'c', name: 'C' }, { user_id: 'd', name: 'D' }];
const contributions = members.map(member => ({ payer_id: member.user_id, amount: 4000000 }));

test('Cao Bang: a personal advance is owed by the fund but not charged twice', () => {
  const expenses = [
    { amount: 872000, payer_id: 'a', reimbursed: false },
    { amount: 14549132, payer_id: null, reimbursed: false }
  ];
  const totals = calculateTotals({ initial_fund: 0 }, expenses, contributions);
  assert.equal(totals.spent, 15421132);
  assert.equal(totals.fund, 16000000);
  assert.equal(totals.dueToMembers, 872000);
  assert.equal(totals.cashFund, 1450868);
  assert.equal(totals.actualFund, 578868);
  const balances = calculateMemberBalances(members, expenses, contributions, totals);
  assert.equal(balances[0].outstanding, 872000);
  assert.deepEqual(balances.map(item => item.b), [0, 0, 0, 0]);
  assert.deepEqual(settle(balances), []);
});

test('reimbursing an advance moves money out of cash but does not change net fund', () => {
  const expenses = [{ amount: 872000, payer_id: 'a', reimbursed: false }];
  const before = calculateTotals({ initial_fund: 0 }, expenses, contributions);
  const after = calculateTotals({ initial_fund: 0 }, [{ ...expenses[0], reimbursed: true }], contributions);
  assert.equal(before.dueToMembers, 872000);
  assert.equal(after.dueToMembers, 0);
  assert.equal(before.cashFund - after.cashFund, 872000);
  assert.equal(before.actualFund, after.actualFund);
});

test('unequal contributions produce balanced transfers without changing their original inputs', () => {
  const deposits = [{ payer_id: 'a', amount: 600 }, { payer_id: 'b', amount: 200 }];
  const two = members.slice(0, 2);
  const totals = calculateTotals({ initial_fund: 0 }, [], deposits);
  const balances = calculateMemberBalances(two, [], deposits, totals);
  assert.deepEqual(balances.map(item => item.b), [200, -200]);
  assert.deepEqual(settle(balances), [{ from: 'B', to: 'A', amount: 200 }]);
  assert.equal(balances[1].b, -200);
});

test('initial fund is shared evenly and no members stays finite', () => {
  const totals = calculateTotals({ initial_fund: 1000 }, [{ amount: 300, payer_id: null }], []);
  assert.equal(totals.actualFund, 700);
  assert.deepEqual(calculateMemberBalances([], [], [], totals), []);
  const balances = calculateMemberBalances(members.slice(0, 2), [{ amount: 300, payer_id: null }], [], totals);
  assert.deepEqual(balances.map(item => item.b), [0, 0]);
});

test('settlement preserves existing half-unit threshold and rounding', () => {
  assert.deepEqual(settle([{name:'A', b:-0.4},{name:'B', b:0.4}]), []);
  assert.deepEqual(settle([{name:'A', b:-10.6},{name:'B', b:10.6}]), [{from:'A',to:'B',amount:11}]);
});

test('Vietnam date crosses UTC midnight correctly', () => {
  assert.equal(vietnamDate(new Date('2026-11-02T17:05:00Z')), '2026-11-03');
  assert.equal(vietnamDate(new Date('2026-11-03T16:59:00Z')), '2026-11-03');
  assert.equal(vietnamDate(new Date('2026-11-03T17:01:00Z')), '2026-11-04');
});
