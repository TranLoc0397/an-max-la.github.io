const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=require('../trip-ui.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('sort by business date with exact created_at as tiebreaker, without mutation',()=>{
 const expenses=[
  {id:'b',spent_on:'2026-11-05',created_at:'2026-11-05T05:01:00Z'},
  {id:'c',spent_on:'2026-11-04',created_at:'2026-11-04T23:59:00Z'},
  {id:'a',spent_on:'2026-11-05',created_at:'2026-11-05T12:31:00Z'}
 ];
 assert.deepEqual(ui.sortByDate(expenses,'spent_on','newest').map(x=>x.id),['a','b','c']);
 assert.deepEqual(ui.sortByDate(expenses,'spent_on','oldest').map(x=>x.id),['c','b','a']);
 assert.deepEqual(expenses.map(x=>x.id),['b','c','a']);
});
test('date/time audit sorting follows full recorded timestamp',()=>{
 const history=[{id:'early',recorded_at:'2026-11-05T09:01:00Z'},{id:'late',recorded_at:'2026-11-05T09:08:00Z'}];
 assert.deepEqual(ui.sortByDate(history,'recorded_at','newest').map(x=>x.id),['late','early']);
 assert.deepEqual(ui.sortByDate(history,'recorded_at','oldest').map(x=>x.id),['early','late']);
});
test('audit details show only changed business fields and both old/new values',()=>{
 const event={source_table:'expenses',action:'UPDATE',
  before_data:{id:'some-id',title:'Ăn tối',amount:120000,spent_on:'2026-11-05',receipt_path:null},
  after_data:{id:'some-id',title:'Ăn tối',amount:135000,spent_on:'2026-11-06',receipt_path:'private-path'}
 };
 const fields=ui.activityChanges(event);
 assert.deepEqual(fields.map(x=>x.key),['amount','spent_on','receipt_path']);
 assert.equal(fields[0].before,120000);
 assert.equal(fields[0].after,135000);
 assert.ok(!fields.some(x=>x.key==='id'));
});
test('created and deleted actions include meaningful field values without IDs or timestamps',()=>{
 const created=ui.activityChanges({source_table:'contributions',action:'INSERT',after_data:{id:'secret',amount:50000,note:'Đóng thêm',created_by:'private',created_at:'now'}});
 assert.deepEqual(created.map(x=>x.key),['amount','note']);
 const deleted=ui.activityChanges({source_table:'member_debts',action:'DELETE',before_data:{amount:50000,debtor_id:'member-1',creditor_id:'member-2'}});
 assert.deepEqual(deleted.map(x=>x.key),['amount','debtor_id','creditor_id']);
});
test('three visible chronological controls and expandable field audit are wired',()=>{
 const html=read('index.html'),app=read('app.js');
 for(const id of ['expenseDateSort','fundDateSort','activityDateSort']){
  assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(app,new RegExp(id));
 }
 assert.match(html,/Quỹ đã đóng<\/span>/);
 assert.match(app,/TripTogetherUI\.activityChanges\(event\)/);
 assert.match(app,/class="audit-detail"/);
 assert.match(app,/class="audit-old"/);
 assert.match(app,/class="audit-new"/);
 assert.match(app,/sortByDate\(contributions/);
 assert.match(app,/sortByDate\(activityEvents/);
});
