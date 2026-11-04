const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const finance=require('../finance.js');
const {applyPayments,calculateTotals,calculateMemberBalances,calculateDebtBalances,settle}=finance;
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

const members=[{user_id:'a',name:'An'},{user_id:'b',name:'Bình'},{user_id:'c',name:'Chi'}];

// Mirrors the pipeline app.js uses to fill the reconciliation cards.
function reconcile({trip={initial_fund:0},expenses=[],contributions=[],debts=[],payments=[],people=members}={}){
 const enriched=applyPayments(expenses,debts,payments);
 const totals=calculateTotals(trip,enriched.expenses,contributions);
 const fundBalances=calculateMemberBalances(people,enriched.expenses,contributions,totals);
 const debtBalances=calculateDebtBalances(people,enriched.debts);
 return {enriched,totals,fundBalances,debtBalances,fundTransfers:settle(fundBalances),debtTransfers:settle(debtBalances)};
}
const sum=list=>list.reduce((s,x)=>s+x,0);
const netAfter=(balances,transfers)=>{
 const net=new Map(balances.map(b=>[b.name,b.b]));
 for(const t of transfers){net.set(t.from,net.get(t.from)+t.amount);net.set(t.to,net.get(t.to)-t.amount)}
 return [...net.values()];
};

test('empty trip shows the empty state in every reconciliation card',()=>{
 const r=reconcile();
 assert.deepEqual(r.fundTransfers,[]);
 assert.deepEqual(r.debtTransfers,[]);
 assert.equal(r.enriched.debts.length,0);
 assert.match(app,/Quỹ đã cân đối theo phần đóng góp\./);
 assert.match(app,/Chưa ghi khoản nợ nào\./);
 assert.match(app,/Không có khoản nợ chưa thanh toán\./);
 assert.match(app,/Chưa có thanh toán nào\./);
});

test('equal contributions are already balanced',()=>{
 const contributions=members.map(m=>({payer_id:m.user_id,amount:1000000}));
 const r=reconcile({contributions,expenses:[{amount:900000,payer_id:null}]});
 assert.deepEqual(r.fundBalances.map(b=>b.b),[0,0,0]);
 assert.deepEqual(r.fundTransfers,[]);
});

test('unequal contributions produce transfers that zero every member balance',()=>{
 const contributions=[{payer_id:'a',amount:900000},{payer_id:'b',amount:300000},{payer_id:'c',amount:0}];
 const r=reconcile({contributions,expenses:[{amount:600000,payer_id:null}]});
 assert.equal(Math.round(sum(r.fundBalances.map(b=>b.b))),0,'balances are zero-sum');
 assert.deepEqual(r.fundTransfers,[
  {from:'Bình',to:'An',amount:100000},
  {from:'Chi',to:'An',amount:400000}
 ]);
 for(const v of netAfter(r.fundBalances,r.fundTransfers))assert.ok(Math.abs(v)<1);
});

test('a member advance owed by the fund is not suggested as a member-to-member transfer',()=>{
 const contributions=members.map(m=>({payer_id:m.user_id,amount:500000}));
 const advance={id:'e1',amount:300000,payer_id:'a',reimbursed:false};
 const before=reconcile({contributions,expenses:[advance]});
 assert.equal(before.totals.dueToMembers,300000);
 assert.deepEqual(before.fundTransfers,[]);
 const after=reconcile({contributions,expenses:[advance],payments:[{expense_id:'e1',amount:300000}]});
 assert.equal(after.totals.dueToMembers,0);
 assert.equal(after.totals.actualFund,before.totals.actualFund);
 assert.deepEqual(after.fundTransfers,[]);
});

test('opposite private debts are netted into one suggested transfer',()=>{
 const debts=[
  {id:'d1',debtor_id:'a',creditor_id:'b',amount:300000,is_settled:false},
  {id:'d2',debtor_id:'b',creditor_id:'a',amount:100000,is_settled:false}
 ];
 assert.deepEqual(reconcile({debts}).debtTransfers,[{from:'An',to:'Bình',amount:200000}]);
});

test('chained private debts are simplified to skip the middle member',()=>{
 const debts=[
  {id:'d1',debtor_id:'a',creditor_id:'b',amount:100000,is_settled:false},
  {id:'d2',debtor_id:'b',creditor_id:'c',amount:100000,is_settled:false}
 ];
 const r=reconcile({debts});
 assert.deepEqual(r.debtBalances.find(b=>b.id==='b').b,0);
 assert.deepEqual(r.debtTransfers,[{from:'An',to:'Chi',amount:100000}]);
});

test('settled and fully paid debts disappear from suggestions, partial debts keep the remainder',()=>{
 const debts=[
  {id:'d1',debtor_id:'a',creditor_id:'b',amount:200000,is_settled:true},
  {id:'d2',debtor_id:'c',creditor_id:'b',amount:200000,is_settled:false},
  {id:'d3',debtor_id:'a',creditor_id:'c',amount:500000,is_settled:false}
 ];
 const payments=[{debt_id:'d2',amount:200000},{debt_id:'d3',amount:150000}];
 const r=reconcile({debts,payments});
 assert.deepEqual(r.enriched.debts.map(d=>d.paid_amount),[200000,200000,150000]);
 assert.deepEqual(r.debtTransfers,[{from:'An',to:'Chi',amount:350000}]);
});

test('payment history reversals restore the outstanding debt',()=>{
 const debts=[{id:'d1',debtor_id:'a',creditor_id:'b',amount:400000,is_settled:false}];
 const paid=reconcile({debts,payments:[{debt_id:'d1',amount:400000}]});
 assert.deepEqual(paid.debtTransfers,[]);
 const undone=reconcile({debts,payments:[{debt_id:'d1',amount:400000},{debt_id:'d1',amount:-400000}]});
 assert.equal(undone.enriched.debts[0].paid_amount,0);
 assert.deepEqual(undone.debtTransfers,[{from:'An',to:'Bình',amount:400000}]);
});

test('overpayments and over-reversals are clamped to the record amount',()=>{
 const debts=[{id:'d1',debtor_id:'a',creditor_id:'b',amount:100000,is_settled:false}];
 assert.equal(reconcile({debts,payments:[{debt_id:'d1',amount:250000}]}).enriched.debts[0].paid_amount,100000);
 assert.equal(reconcile({debts,payments:[{debt_id:'d1',amount:-50000}]}).enriched.debts[0].paid_amount,0);
});

test('expense and debt payments with the same id never leak into each other',()=>{
 const expenses=[{id:'x',amount:300000,payer_id:'a',reimbursed:false}];
 const debts=[{id:'x',debtor_id:'b',creditor_id:'c',amount:300000,is_settled:false}];
 const r=reconcile({expenses,debts,payments:[{expense_id:'x',amount:300000}]});
 assert.equal(r.enriched.expenses[0].paid_amount,300000);
 assert.equal(r.enriched.debts[0].paid_amount,0);
 assert.deepEqual(r.debtTransfers,[{from:'Bình',to:'Chi',amount:300000}]);
});

test('debts involving a removed member do not create suggestions for remaining members',()=>{
 const debts=[{id:'d1',debtor_id:'ghost',creditor_id:'a',amount:500000,is_settled:false}];
 const r=reconcile({debts});
 assert.equal(r.debtBalances.find(b=>b.id==='a').b,500000);
 assert.deepEqual(r.debtTransfers,[],'no debtor among current members, so nothing to suggest');
});

test('reconciliation cards render settle() output and payment history with reversal sign',()=>{
 assert.match(app,/const expenseTransfers=settle\(expenseBalances\);\$\('expenseSettlements'\)/);
 assert.match(app,/calculateDebtBalances\(members,displayDebts\)/);
 assert.match(app,/\$\('debtSettlements'\)\.innerHTML=transfers\.length/);
 assert.match(app,/payments\.slice\(0,60\)/);
 assert.match(app,/Number\(p\.amount\)<0\?'Hoàn tác · '\+title:title/);
 assert.match(app,/Number\(p\.amount\)<0\?'−':'\+'/);
});

test('real trip snapshot: 4 members x 4.000.000, Lộc advanced 872.000 -> balanced, fund owes Lộc',()=>{
 const people=[{user_id:'an',name:'An'},{user_id:'thuy',name:'Thuỷ'},{user_id:'huong',name:'Hương'},{user_id:'loc',name:'Lộc'}];
 const contributions=people.map(m=>({payer_id:m.user_id,amount:4000000}));
 const expenses=[
  {id:'ve',amount:13649132,payer_id:null},{id:'clover',amount:400000,payer_id:null},
  {id:'eco',amount:200000,payer_id:null},{id:'asy',amount:300000,payer_id:null},
  {id:'cam',amount:872000,payer_id:'loc',reimbursed:false}
 ];
 const r=reconcile({people,contributions,expenses});
 assert.deepEqual(r.fundBalances.map(b=>[b.name,b.paid,b.contributed,Math.round(b.share),b.outstanding]),[
  ['An',0,4000000,3855283,0],['Thuỷ',0,4000000,3855283,0],['Hương',0,4000000,3855283,0],['Lộc',872000,4000000,3855283,872000]
 ]);
 assert.equal(r.totals.dueToMembers,872000);
 assert.deepEqual(r.fundTransfers,[],'card shows "Quỹ đã cân đối theo phần đóng góp."');
 assert.deepEqual(r.debtTransfers,[],'card shows "Không có khoản nợ chưa thanh toán."');
});

test('fund-owes-member card lists only unreimbursed member advances with their remainder',()=>{
 assert.match(app,/const fundDues=displayExpenses\.filter\(x=>x\.payer_id&&Number\(x\.amount\)-Number\(x\.paid_amount\|\|0\)>0\)/);
 assert.match(app,/\$\('fundDueList'\)\.innerHTML=fundDues\.length/);
 assert.match(app,/Quỹ không còn nợ thành viên nào\./);
 const expenses=[
  {id:'cam',title:'Thuê máy ảnh',amount:872000,payer_id:'loc',reimbursed:false},
  {id:'taxi',title:'Taxi',amount:200000,payer_id:'an',reimbursed:false},
  {id:'ve',title:'Vé',amount:500000,payer_id:null}
 ];
 const {expenses:shown}=applyPayments(expenses,[],[{expense_id:'taxi',amount:200000},{expense_id:'cam',amount:300000}]);
 const dues=shown.filter(x=>x.payer_id&&Number(x.amount)-Number(x.paid_amount||0)>0);
 assert.deepEqual(dues.map(x=>[x.id,x.amount-x.paid_amount]),[['cam',572000]]);
});

test('expense list and category filter show Vietnamese category labels, keeping raw values',()=>{
 assert.match(app,/CATEGORY_LABELS=\{Food:'Ăn uống',Transport:'Di chuyển',Accommodation:'Lưu trú',Tickets:'Vé tham quan',Shopping:'Mua sắm',Other:'Khác'\}/);
 assert.match(app,/\$\{esc\(x\.spent_on\)\} · \$\{esc\(categoryLabel\(x\.category\)\)\}/);
 assert.match(app,/<option value="\$\{esc\(category\)\}">\$\{esc\(categoryLabel\(category\)\)\}<\/option>/);
});

test('a trip deleted elsewhere is reported and closed instead of showing "Sync error"',()=>{
 assert.match(app,/async function handleDeletedTrip\(tripId\)\{/);
 assert.match(app,/db\.from\('trips'\)\.select\('id'\)\.eq\('id',tripId\)\.maybeSingle\(\)/);
 assert.match(app,/if\(await handleDeletedTrip\(tripId\)\)return;\n   status\('Sync error'\)/);
 assert.match(app,/withButtonLoading\(\$\('leaveBtn'\),'Loading…',closeTripView\)/);
});
