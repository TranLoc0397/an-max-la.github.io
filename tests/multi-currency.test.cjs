const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const C=require('../currency.js');
const F=require('../finance.js');globalThis.TripTogetherFinance=F;
const X=require('../excel-backup.js');

test('parses amounts typed in Vietnamese or international style',()=>{
 const cases={'12.50':12.5,'12,5':12.5,'12,50':12.5,'170.55':170.55,'25.400':25400,'1,000':1000,'1.234,56':1234.56,'1,234.56':1234.56,
  '1.234.567':1234567,'2 100 000':2100000,'0,0001':0.0001,'7':7,' 99 ':99};
 for(const [input,want] of Object.entries(cases))assert.equal(C.parseAmount(input),want,input);
 for(const bad of ['','abc','-5','1.2.3,4,5','12a','1,2,3.4.5','.'])assert.ok(Number.isNaN(C.parseAmount(bad)),bad);
});

test('converts to whole VND with normal rounding',()=>{
 assert.equal(C.toVnd(12.5,25400),317500);
 assert.equal(C.toVnd(1000,170.55),170550);
 assert.equal(C.toVnd(0.01,25400.5),254);
 assert.equal(C.toVnd(3,0.5),2);
});

test('validates foreign entries with per-currency decimals and sane limits',()=>{
 assert.equal(C.validate({currency:'VND'}),'');
 assert.equal(C.validate({currency:'USD',original:12.5,rate:25400}),'');
 assert.match(C.validate({currency:'XYZ',original:1,rate:1}),/không được hỗ trợ/);
 assert.match(C.validate({currency:'USD',original:0,rate:25400}),/số tiền gốc/);
 assert.match(C.validate({currency:'USD',original:NaN,rate:25400}),/số tiền gốc/);
 assert.match(C.validate({currency:'USD',original:10,rate:0}),/tỷ giá/);
 assert.match(C.validate({currency:'USD',original:1.234,rate:25400}),/tối đa 2 chữ số/);
 assert.match(C.validate({currency:'JPY',original:100.5,rate:170}),/tối đa 0 chữ số/);
 assert.equal(C.validate({currency:'JPY',original:1000,rate:170.55}),'');
 assert.match(C.validate({currency:'KRW',original:1,rate:0.1}),/ít nhất 1 ₫/);
 assert.match(C.validate({currency:'USD',original:1e12,rate:25400}),/quá lớn/);
 assert.match(C.validate({currency:'USD',original:1,rate:2e9}),/không hợp lệ/);
});

test('every listed currency is a valid ISO code Intl can format, VND first',()=>{
 assert.equal(C.CURRENCIES[0].code,'VND');
 const codes=C.CURRENCIES.map(c=>c.code);
 assert.equal(new Set(codes).size,codes.length,'duplicate currency');
 for(const c of C.CURRENCIES){
  assert.match(c.code,/^[A-Z]{3}$/);
  assert.doesNotThrow(()=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:c.code}).format(1));
  assert.ok([0,2].includes(c.decimals),c.code);
 }
});

test('describes a foreign expense under its VND amount; VND or incomplete rows show nothing',()=>{
 const d=C.describe({currency:'USD',original_amount:12.5,fx_rate:25400});
 assert.match(d,/12,50/);assert.match(d,/1 USD = 25\.400 ₫/);
 assert.match(C.describe({currency:'JPY',original_amount:1000,fx_rate:170.55}),/1 JPY = 170,55 ₫/);
 assert.equal(C.describe({currency:'VND',amount:100}),'');
 assert.equal(C.describe({currency:'USD',original_amount:null,fx_rate:25400}),'');
 assert.equal(C.describe(null),'');
});

test('fetchRate reads VND from the API and reports failures clearly',async()=>{
 const ok=async url=>{assert.equal(url,'https://open.er-api.com/v6/latest/THB');return {ok:true,json:async()=>({result:'success',rates:{VND:712.345678}})}};
 assert.equal(await C.fetchRate('THB',ok),712.3457);
 await assert.rejects(C.fetchRate('THB',async()=>({ok:false,status:503})),/HTTP 503/);
 await assert.rejects(C.fetchRate('THB',async()=>({ok:true,json:async()=>({result:'error'})})),/Không lấy được tỷ giá VND/);
 await assert.rejects(C.fetchRate('VND',ok),/không hợp lệ/);
 await assert.rejects(C.fetchRate('THB',null),/không hỗ trợ/);
});

test('balances keep using the VND amount, so a foreign expense needs no finance changes',()=>{
 const members=[{user_id:'a',name:'An'},{user_id:'b',name:'Bình'}];
 const expenses=[{id:'e1',amount:C.toVnd(100,25400),payer_id:'a',currency:'USD',original_amount:100,fx_rate:25400}];
 const t=F.calculateTotals({initial_fund:0},expenses,[]);
 assert.equal(t.spent,2540000);
 assert.deepEqual(F.settle(F.calculateMemberBalances(members,expenses,[],t)).map(x=>[x.from,x.to,x.amount]),[]);
 assert.equal(t.dueToMembers,2540000);
});

test('Excel keeps formula columns in place and appends currency columns',()=>{
 const bytes=X.workbook({trip:{name:'T',initial_fund:0},members:[],contributions:[],debts:[],payments:[],reminders:[],
  expenses:[{id:'e1',amount:317500,title:'Pad Thai',spent_on:'2026-11-09',currency:'USD',original_amount:12.5,fx_rate:25400},{id:'e2',amount:50000,title:'Phở',spent_on:'2026-11-09'}]});
 const b=Buffer.from(bytes),files={};let at=0;
 while(b.readUInt32LE(at)===0x04034b50){const size=b.readUInt32LE(at+18),n=b.readUInt16LE(at+26),e=b.readUInt16LE(at+28);
  files[b.slice(at+30,at+30+n).toString()]=b.slice(at+30+n+e,at+30+n+e+size).toString();at+=30+n+e+size}
 const xml=files['xl/worksheets/sheet3.xml'];
 assert.match(xml,/<c r="P1"[^>]*><is><t[^>]*>Tien te<\/t>/);
 assert.match(xml,/<c r="Q1"[^>]*><is><t[^>]*>So tien goc<\/t>/);
 assert.match(xml,/<c r="R1"[^>]*><is><t[^>]*>Ty gia \(VND\)<\/t>/);
 assert.match(xml,/<c r="P2"[^>]*><is><t[^>]*>USD<\/t>/);
 assert.match(xml,/<c r="Q2"[^>]*><v>12\.5<\/v>/);
 assert.match(xml,/<c r="R2"[^>]*><v>25400<\/v>/);
 assert.match(xml,/<c r="P3"[^>]*><is><t[^>]*>VND<\/t>/);
 // Formula columns unchanged: K (refunded), L (fund paid), M (fund owes) still reference G (amount).
 assert.match(xml,/<c r="L2"[^>]*><f>IF\(E2=&quot;&quot;,G2,K2\)<\/f>/);
});

test('database migration enforces a consistent VND ledger and keeps currency on restore',()=>{
 const sql=read('expense_currency.sql');
 assert.match(sql,/add column if not exists currency text not null default 'VND'/);
 assert.match(sql,/add column if not exists original_amount numeric\(18,4\)/);
 assert.match(sql,/add column if not exists fx_rate numeric\(18,6\)/);
 assert.match(sql,/currency='VND' and original_amount is null and fx_rate is null/);
 assert.match(sql,/abs\(amount-round\(original_amount\*fx_rate\)\)<=1/);
 assert.match(sql,/currency,original_amount,fx_rate\)/);
 assert.match(sql,/coalesce\(d->>'currency','VND'\)/);
 // The restore function still refuses expenses with payment history and still checks edit permission.
 assert.match(sql,/This deleted expense has payment history/);
 assert.match(sql,/not public\.can_edit_trip\(p_trip_id\)/);
});

test('app wires currency UI only when the migration exists and sends the computed VND amount',()=>{
 const app=read('app.js'),html=read('index.html'),sw=read('sw.js'),ui=read('trip-ui.js');
 assert.match(html,/<script src="currency\.js\?v=\d+"><\/script>[\s\S]*<script src="app\.js/);
 assert.match(sw,/'\.\/currency\.js'/);
 for(const id of ['expenseCurrencyBlock','expenseCurrency','expenseOriginalAmount','expenseFxRate','expenseFetchRate','expenseFxPreview','expenseAmountLabel'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/id="expenseCurrencyBlock" class="currency-block hidden"/);
 assert.match(app,/db\.from\('expenses'\)\.select\('currency,original_amount,fx_rate'\)\.eq\('trip_id',tripId\)\.limit\(1\)/);
 assert.match(app,/multiCurrencyAvailable=!currencyProbe\.error;/);
 assert.match(app,/\$\('expenseCurrencyBlock'\)\.classList\.toggle\('hidden',!multiCurrencyAvailable\)/);
 assert.match(app,/const fx=readExpenseCurrency\(\);\n  if\(fx\.error\)throw new Error\(fx\.error\);/);
 assert.match(app,/amount:fx\.vnd\?\?Number\(\$\('expenseAmount'\)\.value\)/);
 assert.match(app,/if\(multiCurrencyAvailable\)\{payload\.currency=fx\.currency;payload\.original_amount=fx\.original;payload\.fx_rate=fx\.rate\}/);
 assert.match(app,/<small class="record-fx">/);
 assert.match(ui,/currency:'Tiền tệ',original_amount:'Số tiền gốc',fx_rate:'Tỷ giá'/);
});

test('new labels are translated',()=>{
 const i18n=read('i18n.js');
 for(const vi of ['Tiền tệ','Số tiền gốc','Tỷ giá','Lấy tỷ giá hôm nay','Quy đổi (VNĐ)','Nhập số tiền gốc và tỷ giá để quy đổi sang VND.'])
  assert.match(i18n,new RegExp('"'+vi.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&')+'" *:'),vi);
});
