/* Pure financial calculations. No DOM or database dependencies. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TripTogetherFinance = api;
})(typeof globalThis !== 'undefined' ? globalThis : undefined, function() {
  'use strict';
  function calculateTotals(trip, expenses, contributions) {
    const spent = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const additional = contributions.reduce((sum, item) => sum + Number(item.amount), 0);
    const initial = Number(trip.initial_fund || 0);
    const fund = initial + additional;
    const fundPaid = expenses.reduce((sum, item) =>
      sum + (!item.payer_id || item.reimbursed ? Number(item.amount) : 0), 0);
    const dueToMembers = expenses.reduce((sum, item) =>
      sum + (item.payer_id && !item.reimbursed ? Number(item.amount) : 0), 0);
    const cashFund = fund - fundPaid;
    const actualFund = cashFund - dueToMembers;
    return { spent, additional, initial, fund, fundPaid, dueToMembers, cashFund, actualFund };
  }

  function calculateMemberBalances(members, expenses, contributions, totals) {
    const memberCount = Math.max(1, members.length);
    const sharePerMember = totals.spent / memberCount;
    return members.map(member => {
      const personal = expenses.filter(item => item.payer_id === member.user_id);
      const paid = personal.reduce((sum, item) => sum + Number(item.amount), 0);
      const outstanding = personal.reduce((sum, item) =>
        sum + (!item.reimbursed ? Number(item.amount) : 0), 0);
      const contributed = contributions.filter(item => item.payer_id === member.user_id)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const b = totals.initial / memberCount + contributed - sharePerMember - totals.actualFund / memberCount;
      return { id: member.user_id, name: member.name, paid, outstanding, contributed, share: sharePerMember, b };
    });
  }

  // Preserve the existing transfer order, threshold and rounding behavior.
  function settle(balances) {
    const debt = balances.filter(item => item.b < -.5).map(item => ({ ...item, b: -item.b }));
    const credit = balances.filter(item => item.b > .5).map(item => ({ ...item }));
    const out = [];
    let i = 0, j = 0;
    while (i < debt.length && j < credit.length) {
      const amount = Math.min(debt[i].b, credit[j].b);
      out.push({ from: debt[i].name, to: credit[j].name, amount: Math.round(amount) });
      debt[i].b -= amount;
      credit[j].b -= amount;
      if (debt[i].b < .5) i++;
      if (credit[j].b < .5) j++;
    }
    return out;
  }

  function vietnamDate(date = new Date()) {
    // Date-only inputs are displayed in Vietnam time, not UTC or device timezone.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const get = key => parts.find(part => part.type === key).value;
    return get('year') + '-' + get('month') + '-' + get('day');
  }

  return { calculateTotals, calculateMemberBalances, settle, vietnamDate };
});
