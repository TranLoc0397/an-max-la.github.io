const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const reminder=require('../fund-reminders.js');
global.TripTogetherFinance=require('../finance.js');
const excel=require('../excel-backup.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function zipEntries(data){
 const b=Buffer.from(data),files={};let p=0;
 while(p<b.length&&b.readUInt32LE(p)===0x04034b50){
  const size=b.readUInt32LE(p+18),nl=b.readUInt16LE(p+26),extra=b.readUInt16LE(p+28);
  const name=b.subarray(p+30,p+30+nl).toString(),offset=p+30+nl+extra;
  files[name]=b.subarray(offset,offset+size).toString();
  p=offset+size;
 }
 return files;
}
test('room example: total 2.1m, deposit 400k, reserve 1.7m, no double accounting',()=>{
 const item={title:'Thuê phòng',total_amount:2100000,paid_amount:400000};
 assert.equal(reminder.validate(item),'');
 assert.equal(reminder.remaining(item),1700000);
 assert.deepEqual(reminder.totals([item],2000000),{outstanding:1700000,afterReservations:300000,shortfall:0});
 assert.equal(reminder.totals([item],1400000).shortfall,300000);
 assert.equal(reminder.remaining({...item,paid_amount:2100000}),0);
 const F=global.TripTogetherFinance;
 const base=F.calculateTotals({initial_fund:2000000},[],[]);
 assert.equal(base.actualFund,2000000);
 assert.equal(F.calculateTotals({initial_fund:2000000},[],[]).cashFund,2000000);
});
test('rejects invalid deposits and totals',()=>{
 assert.match(reminder.validate({title:'Room',total_amount:200,paid_amount:300}),/không được|phải từ/);
 assert.match(reminder.validate({title:'Room',total_amount:0,paid_amount:0}),/số nguyên dương/);
 assert.match(reminder.validate({title:'',total_amount:100,paid_amount:0}),/Vui lòng/);
 assert.match(reminder.validate({title:'Room',total_amount:2100000.5,paid_amount:0}),/số nguyên dương/);
});
test('RLS protects reminder CRUD and financial summary excludes unpaid plans',()=>{
 const sql=read('trip_fund_reminders.sql'),app=read('app.js');
 assert.match(sql,/alter table public\.trip_fund_reminders enable row level security/);
 assert.match(sql,/public\.can_edit_trip\(trip_id\)/);
 assert.match(sql,/public\.is_trip_member\(trip_id\)/);
 assert.match(sql,/paid_amount <= total_amount/);
 assert.match(app,/reminderMath\.totals\(fundReminders,actualFund\)/);
 assert.match(app,/fundRemindersAvailable/);
 assert.match(app,/\.from\('trip_fund_reminders'\)/);
 assert.doesNotMatch(read('finance.js'),/fundReminders|trip_fund_reminders/);
});
test('UI accepts planned amount, already paid, date and persists only after save',()=>{
 const html=read('index.html'),app=read('app.js');
 for(const id of ['fundReminderName','fundReminderTotal','fundReminderPaid','fundReminderDue','fundReminderPreview','fundReminderList','fundReminderOverview','fundReminderSave']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/value="2100000"/);assert.match(html,/value="400000"/);
 assert.match(app,/TripTogetherFundReminders\.validate\(payload\)/);
 assert.match(app,/\.insert\(\{\.\.\.payload,trip_id:originalTripId,created_by:user\.id\}\)/);
});
test('Excel contains separate reminder sheet and formulas, with complete raw snapshot',()=>{
 const base={trip:{id:'t',name:'Stay',initial_fund:3000000},members:[],expenses:[],contributions:[],debts:[],payments:[],reminders:[{id:'r1',title:'Thuê phòng',total_amount:2100000,paid_amount:400000}]};
 const files=zipEntries(excel.workbook(base));
 const sheet=files['xl/worksheets/sheet10.xml'];
 assert.match(files['xl/workbook.xml'],/name="Nhac quy"/);
 assert.match(sheet,/Thuê phòng/);
 assert.match(sheet,/<v>1700000<\/v>/);
 assert.match(sheet,/<f>MAX\(0,C2-D2\)<\/f>/);
 assert.match(files['xl/worksheets/sheet1.xml'],/<f>B11-B15<\/f>/);
 assert.match(files['xl/worksheets/sheet9.xml'],/reminders/);
});
