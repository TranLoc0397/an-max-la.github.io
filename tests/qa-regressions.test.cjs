// Regression tests for bugs found in the QA pass over #40–#58 (fund reminders, Excel backup, i18n).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const F=require('../finance.js');globalThis.TripTogetherFinance=F;
const R=require('../fund-reminders.js'),UI=require('../trip-ui.js'),X=require('../excel-backup.js');

// Minimal reader for the stored (uncompressed) zip produced by excel-backup.js.
function unzip(bytes){
 const files={};let at=0;const b=Buffer.from(bytes);
 while(b.readUInt32LE(at)===0x04034b50){
  const method=b.readUInt16LE(at+8),size=b.readUInt32LE(at+18),nameLen=b.readUInt16LE(at+26),extra=b.readUInt16LE(at+28);
  const name=b.slice(at+30,at+30+nameLen).toString();const data=b.slice(at+30+nameLen+extra,at+30+nameLen+extra+size);
  files[name]=method?zlib.inflateRawSync(data).toString():data.toString();at+=30+nameLen+extra+size;
 }
 return files;
}
const XML_INVALID=/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

test('B1: undated reminders sort after dated ones, so the most urgent is first',()=>{
 const items=[
  {id:'a',title:'Không hạn',due_on:null,created_at:'2026-11-01'},
  {id:'b',title:'Sắp hạn',due_on:'2026-11-10',created_at:'2026-11-02'},
  {id:'c',title:'Quá hạn',due_on:'2026-11-08',created_at:'2026-11-03'}
 ];
 assert.deepEqual(UI.sortByDate(items,'due_on','oldest').map(x=>x.id),['c','b','a']);
 assert.deepEqual(UI.sortByDate(items,'due_on','newest').map(x=>x.id),['b','c','a']);
 // Dated lists keep their previous behaviour.
 const dated=[{id:'1',spent_on:'2026-11-02'},{id:'2',spent_on:'2026-11-01'}];
 assert.deepEqual(UI.sortByDate(dated,'spent_on','newest').map(x=>x.id),['1','2']);
 assert.deepEqual(UI.sortByDate(dated,'spent_on','oldest').map(x=>x.id),['2','1']);
});

test('B2: Excel transfer suggestions match the app when members keep app order',()=>{
 const members=[{user_id:'z-1',name:'An',created_at:'2026-01-01T00:00:01Z'},{user_id:'a-2',name:'Bình',created_at:'2026-01-01T00:00:02Z'},
  {user_id:'m-3',name:'Chi',created_at:'2026-01-01T00:00:03Z'},{user_id:'b-4',name:'Dũng',created_at:'2026-01-01T00:00:04Z'}];
 const contributions=[{payer_id:'z-1',amount:700},{payer_id:'a-2',amount:100},{payer_id:'m-3',amount:600},{payer_id:'b-4',amount:200}];
 const totals=F.calculateTotals({initial_fund:0},[],contributions);
 const app=F.settle(F.calculateMemberBalances(members,[],contributions,totals)).map(t=>[t.from,t.to,t.amount]);
 const files=unzip(X.workbook({trip:{name:'T',initial_fund:0},members,expenses:[],contributions,debts:[],payments:[],reminders:[]}));
 const rows=[...files['xl/worksheets/sheet7.xml'].matchAll(/<row r="(\d+)">(.*?)<\/row>/g)].slice(1).map(r=>[...r[2].matchAll(/<t[^>]*>(.*?)<\/t>|<v>(.*?)<\/v>/g)].map(m=>m[1]??m[2]));
 assert.deepEqual(rows.filter(r=>r[0]==='Can doi quy').map(r=>[r[1],r[2],Number(r[3])]),app);
 // The export must fetch members in that same order (not by id).
 const appJs=read('app.js');
 assert.match(appJs,/const order=table==='members'\?\['created_at','user_id'\]:\['id'\];/);
 assert.match(appJs,/from\('members'\)\.select\('\*'\)\.eq\('trip_id',tripId\)\.order\('created_at'\)\.order\('user_id'\)/);
});

test('B3: control characters and lone surrogates never reach the workbook XML',()=>{
 const files=unzip(X.workbook({trip:{name:'T\u0001',initial_fund:0},members:[],contributions:[],debts:[],payments:[],reminders:[],
  expenses:[{id:'e',amount:1,title:'A\u0007B',note:'dòng 1\u000bdòng 2 \uD83D',spent_on:'2026-11-01'}]}));
 for(const [name,body] of Object.entries(files))assert.ok(!XML_INVALID.test(body),name+' contains an XML-invalid character');
 assert.match(files['xl/worksheets/sheet3.xml'],/AB/);
 assert.match(files['xl/worksheets/sheet3.xml'],/dòng 1dòng 2/);
});

test('B4: Excel file name keeps Đ/đ as D/d',()=>{
 assert.equal(X.fileSafeName('Đà Lạt'),'Da-Lat');
 assert.equal(X.fileSafeName('[TEST] Đi Đồng Văn'),'TEST-Di-Dong-Van');
 assert.equal(X.fileSafeName(''),'chuyen-di');
 assert.equal(X.fileSafeName('!!!'),'chuyen-di');
});

test('B5: reminder validation matches the database (title ≤ 100, real calendar dates)',()=>{
 const ok={title:'Thuê phòng',total_amount:2100000,paid_amount:400000};
 assert.equal(R.validate(ok),'');
 assert.match(R.validate({...ok,title:'x'.repeat(101)}),/100 ký tự/);
 assert.equal(R.validate({...ok,title:'x'.repeat(100)}),'');
 for(const bad of ['2026-02-30','2026-13-01','2026-00-10','2026-1-1'])assert.match(R.validate({...ok,due_on:bad}),/Ngày đến hạn/,bad);
 for(const good of ['2028-02-29','2026-12-31'])assert.equal(R.validate({...ok,due_on:good}),'',good);
 assert.match(R.validate({...ok,paid_amount:2100001}),/từ 0 đến tổng tiền/);
});

test('B6: reminder rows show the due date when overdue and the paid amount when fully paid',()=>{
 const app=read('app.js');
 assert.match(app,/const due=item\.due_on&&remaining>0\?`<span>Hạn<\/span> <span>\$\{esc\(fmtDate\(item\.due_on\)\)\}<\/span>`:''/);
 assert.match(app,/\$\{money\(remaining\|\|item\.total_amount\)\}<\/strong><small>\$\{remaining\?'Dự phòng':'Đã trả đủ'\}<\/small>/);
 assert.doesNotMatch(app,/'Cần giữ lại':'Đã thanh toán'/);
});

test('B7: reminder labels are translatable and user-typed text is never translated',()=>{
 const app=read('app.js'),i18n=read('i18n.js'),shell=read('ui-shell.js');
 for(const vi of ['Đã đủ khoản cần trả','Chưa đặt hạn','Hạn','Tổng','Đã cọc/trả','Đã trả đủ','Còn','Đã quá hạn','Cần giữ lại','Cần dự phòng','Sau khi giữ lại'])
  assert.match(i18n,new RegExp('"'+vi.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&')+'" *:'),'missing translation: '+vi);
 assert.match(i18n,/closest\('script,style,textarea,\[data-user-content\]'\)/);
 assert.match(app,/<b data-user-content>\$\{esc\(item\.title\)\}<\/b>/);
 assert.match(app,/<div class="record-title" data-user-content>\$\{esc\(x\.title\)\}<\/div>/);
 assert.match(app,/record-note" data-user-content>/);
 assert.match(shell,/<b data-user-content>'\+escapeText\(item\.title\)/);
});

test('B8: Excel export still works before trip_fund_reminders.sql is installed',()=>{
 assert.match(read('app.js'),/fundRemindersAvailable\?excelExportRows\('trip_fund_reminders',tripId\):Promise\.resolve\(\[\]\)/);
});

test('B9: editing a reminder refreshes updated_at',()=>{
 assert.match(read('app.js'),/update\(\{\.\.\.payload,updated_at:new Date\(\)\.toISOString\(\)\}\)/);
});

test('new English labels are unique so switching back to Vietnamese restores the right text',()=>{
 const i18n=read('i18n.js');
 const pairs=[...i18n.slice(i18n.indexOf('const dictionary={')).matchAll(/"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
 for(const en of ['Fully paid','No due date','Deposit/paid','Paid in full','Reserve needed','After reserving']){
  const vi=new Set(pairs.filter(p=>p[2]===en).map(p=>p[1]));
  assert.equal(vi.size,1,en+' maps back to '+[...vi].join(' / '));
 }
});
