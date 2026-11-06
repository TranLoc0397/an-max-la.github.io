const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const api=(()=>{
 const context={
  window:{},
  crypto:{randomUUID:()=> 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'},
  Object
 };
 vm.runInNewContext(read('receipts.js'),context);
 return context.window.TripTogetherReceipts;
})();
const TRIP='11111111-1111-4111-8111-111111111111';
const EXPENSE='22222222-2222-4222-8222-222222222222';

test('camera and gallery inputs support mobile photo capture without public URLs',()=>{
 const html=read('index.html');
 assert.match(html,/id="expenseReceiptFile"[^>]*accept="image\/jpeg,image\/png,image\/webp"/);
 assert.match(html,/id="expenseReceiptCamera"[^>]*accept="image\/\*" capture="environment"/);
 assert.match(html,/src="receipts.js\?v=1"/);
 const app=read('app.js');
 assert.match(app,/expenseCaptureReceipt'\)\.onclick/);
 assert.match(app,/expensePickReceipt'\)\.onclick/);
 assert.match(app,/TripTogetherReceipts\.signedUrl\(db,current\)/);
 assert.doesNotMatch(app,/getPublicUrl\(/);
});

test('receipt validates supported formats and 5MB size',()=>{
 for(const mime of ['image/jpeg','image/png','image/webp']){
  assert.equal(api.validate({type:mime,size:1048}),'');
 }
 assert.match(api.validate({type:'image/heic',size:50}),/JPG/);
 assert.match(api.validate({type:'image/svg+xml',size:50}),/JPG/);
 assert.match(api.validate({type:'image/png',size:5*1024*1024+1}),/5 MB/);
 assert.match(api.validate({type:'image/png',size:0}),/5 MB/);
 assert.match(api.validate(null),/chọn ảnh/);
});

test('path is private and scoped to trip and expense ids',()=>{
 assert.equal(api.makePath(TRIP,EXPENSE,{type:'image/jpeg',size:42}),
  TRIP+'/'+EXPENSE+'/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg');
 assert.throws(()=>api.makePath('../bad',EXPENSE,{type:'image/png',size:10}));
});

test('upload uses immutable private object and short-lived signed URL',async()=>{
 const calls=[];
 const db={storage:{from(bucket){
  assert.equal(bucket,'trip-receipts');
  return {
   upload:async (...args)=>{calls.push(['upload',...args]);return {error:null}},
   createSignedUrl:async (p,ttl)=>{calls.push(['sign',p,ttl]);return {data:{signedUrl:'https://example.test/signed'},error:null}},
   remove:async paths=>{calls.push(['remove',paths]);return {error:null}}
  };
 }}};
 const file={type:'image/webp',size:40};
 const key=await api.upload(db,TRIP,EXPENSE,file);
 assert.ok(key.endsWith('.webp'));
 assert.equal(calls[0][2],file);
 assert.equal(calls[0][3].upsert,false);
 assert.equal(calls[0][3].contentType,'image/webp');
 assert.equal(await api.signedUrl(db,key),'https://example.test/signed');
 assert.equal(calls[1][2],120);
 await api.remove(db,key);
 assert.equal(calls[2][1][0],key);
});

test('RLS migration stores files privately and restricts trip membership/editors',()=>{
 const sql=read('expense_receipts.sql');
 assert.match(sql,/add column if not exists receipt_path text/);
 assert.match(sql,/values \('trip-receipts','trip-receipts',false,5242880/);
 assert.match(sql,/public\.is_trip_member/);
 assert.match(sql,/public\.can_edit_trip/);
 assert.match(sql,/for insert to authenticated/);
 assert.match(sql,/for select to authenticated/);
 assert.match(sql,/for delete to authenticated/);
 assert.doesNotMatch(sql,/for update to authenticated/);
 assert.match(sql,/array_length\(storage\.foldername\(storage\.objects\.name\),1\)=2/);
});

test('receipt persistence handles upload rollback, replacement and deletion',()=>{
 const js=read('app.js');
 assert.match(js,/uploadedPath=await receipt\.upload/);
 assert.match(js,/if\(uploadedPath\)\{try\{await receipt\.remove/);
 assert.match(js,/if\(result\.error\)throw result\.error/);
 assert.match(js,/payload\.receipt_path=null/);
 assert.match(js,/if\(existing\?\.receipt_path&&\(uploadedPath/);
 assert.match(js,/if\(table==='expenses'\)/);
});
