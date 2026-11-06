const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
global.TripTogetherFinance=require('../finance.js');
const Excel=require('../excel-backup.js');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
function unzipStore(bytes){
 const buf=Buffer.from(bytes),files={};let p=0;
 while(p<buf.length&&buf.readUInt32LE(p)===0x04034b50){
  const size=buf.readUInt32LE(p+18),nameLength=buf.readUInt16LE(p+26),extra=buf.readUInt16LE(p+28);
  const name=buf.subarray(p+30,p+30+nameLength).toString();
  const dataStart=p+30+nameLength+extra;
  files[name]=buf.subarray(dataStart,dataStart+size).toString();
  p=dataStart+size;
 }
 return files;
}
const snapshot={
 trip:{id:'trip-x',name:'Thử & kiểm tra < quỹ',initial_fund:1000000},
 members:[{user_id:'u1',name:'An',is_guest:false},{user_id:'u2',name:'Thủy',is_guest:true}],
 expenses:[
  {id:'e1',trip_id:'trip-x',title:'Cơm & cafe',amount:900000,payer_id:'u1',payer_name:'An',reimbursed:false,spent_on:'2026-11-04'},
  {id:'e2',trip_id:'trip-x',title:'Vé',amount:500000,payer_id:null,payer_name:'Quỹ',reimbursed:false,spent_on:'2026-11-05'},
  {id:'e3',trip_id:'trip-x',title:'Khách sạn',amount:200000,payer_id:'u2',payer_name:'Thủy',reimbursed:true,spent_on:'2026-11-05'}
 ],
 contributions:[{id:'c1',trip_id:'trip-x',payer_id:'u1',payer_name:'An',paid_on:'2026-11-01',amount:400000}],
 debts:[{id:'d1',trip_id:'trip-x',debtor_id:'u1',creditor_id:'u2',amount:100000,is_settled:false,incurred_on:'2026-11-05'}],
 payments:[{id:'p1',trip_id:'trip-x',expense_id:'e1',amount:300000,paid_on:'2026-11-05'}, {id:'p2',trip_id:'trip-x',debt_id:'d1',amount:25000,paid_on:'2026-11-05'}]
};
test('produces complete standalone XLSX (real ZIP) with all financial sheets and raw records',()=>{
 const b=Excel.workbook(snapshot),files=unzipStore(b);
 assert.equal(b[0],0x50);assert.equal(b[1],0x4b);
 assert.ok(files['[Content_Types].xml']);
 assert.ok(files['xl/workbook.xml']);
 assert.ok(files['xl/styles.xml']);
 assert.ok(files['xl/worksheets/sheet9.xml']);
 const w=files['xl/workbook.xml'];
 for(const name of ['Tong quan','Thanh vien','Khoan chi','Dong quy','No rieng','Thanh toan','Goi y chuyen tien','Cong thuc','Du lieu goc JSON'])
  assert.ok(w.includes('name="'+name+'"'),name);
 const raw=files['xl/worksheets/sheet9.xml'];
 assert.ok(raw.includes('Cơm &amp; cafe'));
 assert.ok(raw.includes('Thử &amp; kiểm tra &lt; quỹ'));
 assert.ok(raw.includes('receipt_path')===false);
});
test('amounts and calculation formulas match finance.js exactly including partial payments',()=>{
 const files=unzipStore(Excel.workbook(snapshot));
 const exp=files['xl/worksheets/sheet3.xml'],debts=files['xl/worksheets/sheet5.xml'];
 const summary=files['xl/worksheets/sheet1.xml'],members=files['xl/worksheets/sheet2.xml'];
 assert.match(exp,/<f>IF\(E2=/);
 assert.match(exp, /<c r="K2" s="2"><f>[\s\S]*<v>300000<\/v>/);
 assert.match(exp, /<c r="K4" s="2"><f>[\s\S]*<v>200000<\/v>/);
 assert.match(debts, /<c r="I2" s="2"><f>[\s\S]*<v>75000<\/v>/);
 assert.match(summary, /<c r="B5" s="2"><f>[\s\S]*?<v>1600000<\/v>/);
 assert.match(summary, /<c r="B8" s="2"><f>[\s\S]*?<v>1000000<\/v>/);
 assert.match(summary, /<c r="B9" s="2"><f>[\s\S]*?<v>600000<\/v>/);
 assert.match(summary, /<c r="B11" s="2"><f>[\s\S]*?<v>-200000<\/v>/);
 assert.match(members,/SUMIF\(/);
 assert.match(members,/IFERROR\(/);
 assert.match(files['xl/worksheets/sheet8.xml'],/ROUND/);
});
test('exporter does not use online APIs and requires fresh paginated data',()=>{
 const exporter=read('excel-backup.js'),app=read('app.js'),html=read('index.html');
 assert.doesNotMatch(exporter,/fetch\s*\(|https?:\/\//);
 assert.match(html,/id="exportExcelBtn"/);
 assert.match(html,/src="excel-backup.js\?v=1"/);
 assert.match(app,/\.range\(start,start\+499\)/);
 assert.match(app,/excelExportRows\('trip_payments',tripId\)/);
 assert.match(app,/excelExportRows\('member_debts',tripId\)/);
 assert.match(app,/TripTogetherExcelBackup\.download/);
 assert.match(app,/view_passcode_hash, \.\.\.safeTrip/);
 assert.match(read('sw.js'),/'\.\/excel-backup\.js'/);
});
