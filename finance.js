/* Pure financial calculations. No DOM or database dependencies. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TripTogetherFinance = api;
})(typeof globalThis !== 'undefined' ? globalThis : undefined, function() {
  'use strict';
  function applyPayments(expenses, debts, payments) {
    const expenseTotals = new Map(), debtTotals = new Map();
    for (const payment of payments || []) {
      const map = payment.expense_id ? expenseTotals : debtTotals;
      const key = payment.expense_id || payment.debt_id;
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + Number(payment.amount));
    }
    const amountPaid = (row, values, completed) => {
      const amount = Number(row.amount);
      return Math.min(amount, Math.max(0, values.has(row.id) ? values.get(row.id) : completed ? amount : 0));
    };
    return {
      expenses: expenses.map(row => ({ ...row, paid_amount: row.payer_id ? amountPaid(row, expenseTotals, row.reimbursed) : 0 })),
      debts: debts.map(row => ({ ...row, paid_amount: amountPaid(row, debtTotals, row.is_settled) }))
    };
  }
  const reimbursedAmount = item => item.payer_id
    ? Math.max(0, Math.min(Number(item.amount), item.paid_amount == null ? (item.reimbursed ? Number(item.amount) : 0) : Number(item.paid_amount)))
    : Number(item.amount);

  function calculateTotals(trip, expenses, contributions) {
    const spent = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const additional = contributions.reduce((sum, item) => sum + Number(item.amount), 0);
    const initial = Number(trip.initial_fund || 0);
    const fund = initial + additional;
    const fundPaid = expenses.reduce((sum, item) =>
      sum + reimbursedAmount(item), 0);
    const dueToMembers = expenses.reduce((sum, item) =>
      sum + (item.payer_id ? Number(item.amount) - reimbursedAmount(item) : 0), 0);
    const cashFund = fund - fundPaid;
    const actualFund = cashFund - dueToMembers;
    return { spent, additional, initial, fund, fundPaid, dueToMembers, cashFund, actualFund };
  }

  // How one expense is shared (VND, may be fractional like the equal split always was).
  // split = null → everyone in the trip shares equally (the original behaviour).
  // split = {mode:'equal'|'shares'|'exact', weights:{memberId: weight}} → proportional to weights.
  // Weights for ids that are no longer members are ignored and the expense is spread over the
  // remaining participants, so allocations always add up to the full amount and balances stay zero-sum.
  function allocateExpense(expense, members) {
    const amount = Number(expense.amount), ids = members.map(m => m.user_id), out = new Map();
    const weights = expense.split && typeof expense.split === 'object' && expense.split.weights
      ? Object.entries(expense.split.weights).filter(([id, w]) => ids.includes(id) && Number(w) > 0) : [];
    if (!weights.length) {
      for (const id of ids) out.set(id, amount / Math.max(1, ids.length));
      return out;
    }
    const total = weights.reduce((sum, [, w]) => sum + Number(w), 0);
    for (const [id, w] of weights) out.set(id, amount * Number(w) / total);
    return out;
  }

  function memberShares(members, expenses) {
    const shares = new Map(members.map(m => [m.user_id, 0]));
    for (const expense of expenses)
      for (const [id, value] of allocateExpense(expense, members)) shares.set(id, shares.get(id) + value);
    return shares;
  }

  function calculateMemberBalances(members, expenses, contributions, totals) {
    const memberCount = Math.max(1, members.length);
    const sharePerMember = totals.spent / memberCount;
    // Keep the exact original arithmetic when nothing is split unevenly.
    const custom = expenses.some(item => item.split && item.split.weights);
    const shares = custom ? memberShares(members, expenses) : null;
    return members.map(member => {
      const share = custom ? shares.get(member.user_id) : sharePerMember;
      const personal = expenses.filter(item => item.payer_id === member.user_id);
      const paid = personal.reduce((sum, item) => sum + Number(item.amount), 0);
      const outstanding = personal.reduce((sum, item) =>
        sum + (Number(item.amount) - reimbursedAmount(item)), 0);
      const contributed = contributions.filter(item => item.payer_id === member.user_id)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const b = totals.initial / memberCount + contributed - share - totals.actualFund / memberCount;
      return { id: member.user_id, name: member.name, is_guest: !!member.is_guest, paid, outstanding, contributed, share, b };
    });
  }

  function calculateDebtBalances(members, debts) {
    return members.map(member => ({
      id: member.user_id, name: member.name,
      b: debts.reduce((sum, debt) => {
        const due = Math.max(0, Number(debt.amount) -
          Number(debt.paid_amount == null ? (debt.is_settled ? debt.amount : 0) : debt.paid_amount));
        return sum + (debt.creditor_id === member.user_id ? due :
                      debt.debtor_id === member.user_id ? -due : 0);
      }, 0)
    }));
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

  return { calculateTotals, calculateMemberBalances, allocateExpense, memberShares, calculateDebtBalances, applyPayments, settle, vietnamDate };
});
