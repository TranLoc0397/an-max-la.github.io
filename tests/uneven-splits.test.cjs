const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const F=require('../finance.js');globalThis.TripTogetherFinance=F;
const S=require('../split.js'),X=require('../excel-backup.js');
const id=n=>'00000000-0000-4000-8000-00000000000'+n;
const members=[{user_id:id(1),name:'An'},{user_id:id(2),name:'Bình'},{user_id:id(3),name:'Chi'},{user_id:id(4),name:'Dũng'}];
const fund=members.map(m=>({payer_id:m.user_id,amount:1000000}));
const balances=(expenses)=>{const t=F.calculateTotals({initial_fund:0},expenses,fund);return F.calculateMemberBalances(members,expenses,fund,t)};
const sum=a=>a.reduce((s,x)=>s+x,0);

test('no split keeps the exact original equal-share arithmetic',()=>{
 const e=[{amount:1000001,payer_id:null},{amount:333,payer_id:null}];
 const b=balances(e);
 assert.ok(b.every(x=>x.share===(1000001+333)/4),'share must be spent / n exactly');
 assert.deepEqual(b.map(x=>x.b),[0,0,0,0]);
});

test('equal split among some members: only they pay, everyone else gets money back',()=>{
 const e=[{amount:300000,payer_id:null,split:{mode:'equal',weights:{[id(1)]:1,[id(2)]:1,[id(3)]:1}}}];
 const b=balances(e);
 assert.deepEqual(b.map(x=>Math.round(x.share)),[100000,100000,100000,0]);
 assert.ok(Math.abs(sum(b.map(x=>x.b)))<1e-6,'balances stay zero-sum');
 assert.deepEqual(F.settle(b).map(t=>[t.from,t.to,t.amount]),[['An','Dũng',25000],['Bình','Dũng',25000],['Chi','Dũng',25000]]);
});

test('shares 2:1:1 and exact amounts allocate proportionally and add up to the total',()=>{
 const shares=F.allocateExpense({amount:400000,split:{mode:'shares',weights:{[id(1)]:2,[id(2)]:1,[id(3)]:1}}},members);
 assert.deepEqual([...shares.values()],[200000,100000,100000]);
 const exact=F.allocateExpense({amount:2540000,split:{mode:'exact',weights:{[id(1)]:60,[id(4)]:40}}},members); // USD 100 at 25.400
 assert.deepEqual([...exact.entries()],[[id(1),1524000],[id(4),1016000]]);
});

test('weights for people who left are ignored; the expense still adds up and balances stay zero-sum',()=>{
 const ghost='00000000-0000-4000-8000-0000000000ff';
 const e=[{amount:300000,payer_id:id(1),split:{mode:'equal',weights:{[ghost]:1,[id(1)]:1,[id(2)]:1}}}];
 const alloc=F.allocateExpense(e[0],members);
 assert.equal(sum([...alloc.values()]),300000);assert.ok(!alloc.has(ghost));
 assert.ok(Math.abs(sum(balances(e).map(x=>x.b)))<1e-6);
 // Nobody left in the split → back to "everyone, equally".
 assert.deepEqual([...F.allocateExpense({amount:400,split:{mode:'equal',weights:{[ghost]:1}}},members).values()],[100,100,100,100]);
});

test('mixed trip: advances, reimbursement debt and uneven splits remain zero-sum and settle cleanly',()=>{
 const e=[
  {amount:1200000,payer_id:null},
  {amount:600000,payer_id:id(2),split:{mode:'shares',weights:{[id(2)]:2,[id(3)]:1}}},
  {amount:90000,payer_id:null,split:{mode:'exact',weights:{[id(4)]:90000}}}
 ];
 const b=balances(e);assert.ok(Math.abs(sum(b.map(x=>x.b)))<1e-6);
 const after=b.map(x=>({...x}));for(const t of F.settle(b)){after.find(x=>x.name===t.from).b+=t.amount;after.find(x=>x.name===t.to).b-=t.amount}
 assert.ok(after.every(x=>Math.abs(x.b)<1),'every member ends within 1 ₫ after the suggested transfers');
});

test('split.js builds, validates and describes splits',()=>{
 assert.equal(S.build('all',{}),null);
 assert.deepEqual(S.build('equal',{[id(1)]:true,[id(2)]:false,[id(3)]:true}),{mode:'equal',weights:{[id(1)]:1,[id(3)]:1}});
 assert.deepEqual(S.build('shares',{[id(1)]:2,[id(2)]:NaN,[id(3)]:0}),{mode:'shares',weights:{[id(1)]:2}});
 const ctx={entryTotal:100,members};
 assert.equal(S.validate(null,ctx),'');
 assert.match(S.validate({mode:'equal',weights:{}},ctx),/ít nhất một người/);
 assert.match(S.validate({mode:'shares',weights:{}},ctx),/ít nhất một người/);
 assert.match(S.validate({mode:'exact',weights:{[id(1)]:60}},ctx),/Còn 40 chưa chia/);
 assert.match(S.validate({mode:'exact',weights:{[id(1)]:60,[id(2)]:50}},ctx),/vượt 10/);
 assert.equal(S.validate({mode:'exact',weights:{[id(1)]:60.005,[id(2)]:39.995}},ctx),'');
 assert.match(S.validate({mode:'shares',weights:{'00000000-0000-4000-8000-0000000000ff':1}},ctx),/không còn là thành viên/);
 assert.match(S.validate({mode:'shares',weights:{[id(1)]:-1}},ctx),/lớn hơn 0/);
 assert.match(S.validate({mode:'weird',weights:{[id(1)]:1}},ctx),/không hợp lệ/);
 assert.equal(S.remaining({mode:'exact',weights:{[id(1)]:30}},100),70);
 assert.equal(S.describe({mode:'equal',weights:{[id(1)]:1,[id(2)]:1}},members),'Chia đều cho: An, Bình (2/4)');
 assert.equal(S.describe({mode:'shares',weights:{[id(1)]:2,[id(2)]:1}},members),'Chia theo phần: An 2 · Bình 1');
 assert.equal(S.describe({mode:'exact',weights:{[id(1)]:12.5}},members,'USD'),'Chia theo số tiền: An 12,5 USD');
 assert.equal(S.describe(null,members),'');
 assert.ok(S.includes(null,id(4))&&S.includes({weights:{[id(1)]:1}},id(1))&&!S.includes({weights:{[id(1)]:1}},id(4)));
});

test('Excel: member share comes from an allocation sheet, so custom splits recalculate correctly',()=>{
 const bytes=X.workbook({trip:{name:'T',initial_fund:0},members,contributions:fund,debts:[],payments:[],reminders:[],
  expenses:[{id:'e1',title:'Bữa tối',amount:300000,spent_on:'2026-11-10',split:{mode:'equal',weights:{[id(1)]:1,[id(2)]:1,[id(3)]:1}}},{id:'e2',title:'Taxi',amount:400,spent_on:'2026-11-10'}]});
 const b=Buffer.from(bytes),files={};let at=0;
 while(b.readUInt32LE(at)===0x04034b50){const size=b.readUInt32LE(at+18),n=b.readUInt16LE(at+26),e=b.readUInt16LE(at+28);files[b.slice(at+30,at+30+n).toString()]=b.slice(at+30+n+e,at+30+n+e+size).toString();at+=30+n+e+size}
 const alloc=files['xl/worksheets/sheet11.xml'],mem=files['xl/worksheets/sheet2.xml'],wb=files['xl/workbook.xml'];
 assert.match(wb,/name="Phan bo chi phi"/);
 assert.equal((alloc.match(/<row /g)||[]).length,1+3+4,'header + 3 participants + 4 for the equal taxi');
 assert.match(mem,/<c r="F2" s="2"><f>SUMIF\(&apos;Phan bo chi phi&apos;!C2:C8,A2,&apos;Phan bo chi phi&apos;!E2:E8\)<\/f><v>100100<\/v>/);
 assert.match(mem,/<c r="F5" s="2"><f>[^<]*<\/f><v>100<\/v>/,'Dũng only shares the taxi');
 assert.match(files['xl/worksheets/sheet3.xml'],/&quot;mode&quot;:&quot;equal&quot;/);
});

test('migration validates split shape, membership, member removal, merge and restore',()=>{
 const sql=read('expense_splits.sql');
 assert.match(sql,/add column if not exists split jsonb/);
 assert.match(sql,/s->>'mode' in \('equal','shares','exact'\)/);
 assert.match(sql,/abs\(\s*\(select sum\(\(w\.value\)::text::numeric\) from jsonb_each\(s->'weights'\) w\)-coalesce\(original,amount\)\)<=0\.01/);
 assert.match(sql,/add constraint expenses_split_shape check \(public\.expense_split_valid\(split,amount,original_amount\)\)/);
 assert.match(sql,/Split includes someone who is not a member of this trip/);
 assert.match(sql,/or exists\(select 1 from public\.expenses where trip_id=p_trip_id and split->'weights' \? item\.user_id::text\)/);
 const merge=sql.slice(sql.indexOf('create or replace function public.merge_duplicate_trip_members('));
 assert.ok(merge.indexOf("split->'weights' ? p_source_user_id::text")<merge.indexOf('delete from public.members'),'splits are moved before the source member is deleted');
 assert.match(sql,/currency,original_amount,fx_rate,split\)/);
 assert.match(sql,/public\.clean_expense_split\(p_trip_id,d->'split'\)/);
 assert.match(sql,/case when s->>'mode'='exact' then 'shares'/);
});

test('app wires the split UI only when the migration exists and validates before saving',()=>{
 const app=read('app.js'),html=read('index.html'),sw=read('sw.js'),i18n=read('i18n.js'),ui=read('trip-ui.js');
 for(const idx of ['expenseSplitBlock','expenseSplitMode','expenseSplitMembers','expenseSplitSummary'])assert.match(html,new RegExp('id="'+idx+'"'));
 assert.match(html,/id="expenseSplitBlock" class="split-block hidden"/);
 assert.match(html,/<script src="split\.js\?v=\d+"><\/script>[\s\S]*<script src="app\.js/);
 assert.match(sw,/'\.\/split\.js'/);
 assert.match(app,/db\.from\('expenses'\)\.select\('split'\)\.eq\('trip_id',tripId\)\.limit\(1\)/);
 assert.match(app,/splitAvailable=!splitProbe\.error;/);
 assert.match(app,/if\(splitAvailable\)\{\n   const split=readExpenseSplit\(\),splitError=window\.TripTogetherSplit\.validate\(split,\{entryTotal:fx\.original\?\?payload\.amount,members\}\);\n   if\(splitError\)throw new Error\(splitError\);\n   payload\.split=split;/);
 assert.match(app,/window\.TripTogetherFinance\.allocateExpense\(\{amount:vnd,split\},members\)/,'preview uses the same allocation as balances');
 assert.match(ui,/split:'Cách chia'/);
 for(const vi of ['Chia cho','Cả nhóm, chia đều','Một số người, chia đều','Theo phần (ví dụ 2 : 1)','Theo số tiền cụ thể'])assert.match(i18n,new RegExp('"'+vi.replace(/[()]/g,'\\$&')+'" *:'),vi);
});
