const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('financial reconciliation and history are grouped in one panel with unique IDs',()=>{
 const html=read('index.html');
 const start=html.indexOf('<section class="tt-reconciliation"');
 const end=html.indexOf('</section>\n  <footer>',start);
 assert.ok(start!==-1,'reconciliation section exists');
 const segment=html.slice(start,end===-1?undefined:end);
 assert.match(segment,/id="reconciliationTitle">Đối soát quỹ/);
 for(const id of ['expenseSettlements','debtList','debtSettlements','paymentHistory','activityPanel','activityList']){
   assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' must appear exactly once');
   assert.ok(segment.includes('id="'+id+'"'),id+' must remain inside the grouped section');
 }
 assert.equal((segment.match(/class="tt-reconciliation-card(?:\s|")/g)||[]).length,5);
});

test('responsive reconciliation cards do not hide content or change data sources',()=>{
 const css=read('styles.css'),app=read('app.js');
 assert.match(css,/#peopleTab \.tt-reconciliation-grid\{/);
 assert.match(css,/@media\(max-width:860px\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/#peopleTab \.tt-reconciliation-activity \.tt-reconciliation-content\{grid-template-columns:1fr/);
 for(const id of ['expenseSettlements','debtList','debtSettlements','paymentHistory','activityPanel','activityList'])
   assert.ok(app.includes("'"+id+"'"),'existing renderer still uses '+id);
 assert.match(app,/TripTogetherFinance\.calculateTotals/);
 assert.match(app,/record_trip_payment/);
});
