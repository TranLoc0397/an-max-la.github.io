const test=require('node:test');
const assert=require('node:assert/strict');
const finance=require('../finance.js');
const {filterExpenses}=require('../trip-ui.js');
const members=[{user_id:'a',name:'Alice'},{user_id:'b',name:'Bob'}];
const contributions=[{payer_id:'a',amount:1000}];
const baseExpense=[{id:'e1',payer_id:'b',payer_name:'Bob',title:'Camera',note:'Rental',category:'Other',amount:600,reimbursed:false}];

test('partial fund reimbursement reduces cash and outstanding, not actual net fund',()=>{
 const {expenses}=finance.applyPayments(baseExpense,[],[{expense_id:'e1',amount:200}]);
 const totals=finance.calculateTotals({initial_fund:0},expenses,contributions);
 assert.equal(expenses[0].paid_amount,200);
 assert.equal(totals.spent,600);
 assert.equal(totals.cashFund,800);
 assert.equal(totals.dueToMembers,400);
 assert.equal(totals.actualFund,400);
 assert.equal(finance.calculateMemberBalances(members,expenses,contributions,totals)[1].outstanding,400);
});
test('reversed payment updates paid amount and preserves net fund balance',()=>{
 const entries=[{expense_id:'e1',amount:500},{expense_id:'e1',amount:-200}];
 const {expenses}=finance.applyPayments(baseExpense,[],entries);
 assert.equal(expenses[0].paid_amount,300);
 const totals=finance.calculateTotals({initial_fund:0},expenses,contributions);
 assert.equal(totals.cashFund,700);
 assert.equal(totals.dueToMembers,300);
 assert.equal(totals.actualFund,400);
});
test('fully reimbursed historic records without ledger retain previous behavior',()=>{
 const {expenses}=finance.applyPayments([{...baseExpense[0],reimbursed:true}],[],[]);
 assert.equal(expenses[0].paid_amount,600);
 assert.equal(finance.calculateTotals({initial_fund:0},expenses,contributions).dueToMembers,0);
});
test('partial personal debts settle only the outstanding amount',()=>{
 const debts=[{id:'d1',creditor_id:'a',debtor_id:'b',amount:1200,is_settled:false}];
 const {debts:updated}=finance.applyPayments([],debts,[{debt_id:'d1',amount:500}]);
 assert.equal(updated[0].paid_amount,500);
 const balances=finance.calculateDebtBalances(members,updated);
 assert.deepEqual(balances.map(m=>m.b),[700,-700]);
 assert.deepEqual(finance.settle(balances),[{from:'Bob',to:'Alice',amount:700}]);
});
test('search, category and status filters distinguish partially paid expenses',()=>{
 const {expenses}=finance.applyPayments([
  {...baseExpense[0],id:'e1',amount:600},
  {...baseExpense[0],id:'e2',title:'Lunch',category:'Food',amount:100,payer_id:null},
  {...baseExpense[0],id:'e3',title:'Transport',category:'Transport',amount:100}
 ],[],[{expense_id:'e1',amount:200}]);
 assert.deepEqual(filterExpenses(expenses,{query:'cAmErA'}).map(x=>x.id),['e1']);
 assert.deepEqual(filterExpenses(expenses,{category:'Food'}).map(x=>x.id),['e2']);
 assert.deepEqual(filterExpenses(expenses,{status:'partial'}).map(x=>x.id),['e1']);
 assert.deepEqual(filterExpenses(expenses,{status:'due'}).map(x=>x.id),['e3']);
 assert.deepEqual(filterExpenses(expenses,{status:'paid'}).map(x=>x.id),['e2']);
});
test('unknown and deleted payment references do not modify live balances',()=>{
 const {expenses}=finance.applyPayments(baseExpense,[],[{expense_id:'missing',amount:999}]);
 assert.equal(expenses[0].paid_amount,0);
});
