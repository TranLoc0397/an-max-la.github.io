const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'..','expense_receipts.sql'),'utf8');

test('receipt Storage policies reference the outer storage.objects.name, not trips.name',()=>{
 const policy=sql.slice(sql.indexOf('drop policy if exists "trip receipts read"'));
 const clauses=policy.split(/drop policy if exists "trip receipts (?:upload|delete)"/);
 assert.equal(clauses.length,3);
 for(const clause of clauses){
   assert.match(clause,/storage\.foldername\(storage\.objects\.name\)/);
   assert.doesNotMatch(clause,/storage\.foldername\(name\)/);
   assert.match(clause,/public\.trips t/);
 }
});
test('upload still restricts editors, private bucket and image formats',()=>{
 assert.match(sql,/values \('trip-receipts','trip-receipts',false,5242880/);
 assert.match(sql,/array_length\(storage\.foldername\(storage\.objects\.name\),1\)=2/);
 assert.match(sql,/public\.can_edit_trip\(t\.id\)/);
 assert.match(sql,/storage\.extension\(storage\.objects\.name\) in \('jpg','png','webp'\)/);
 assert.match(sql,/for insert to authenticated with check/);
 assert.match(sql,/for select to authenticated using/);
 assert.match(sql,/for delete to authenticated using/);
 assert.doesNotMatch(sql,/for update to authenticated/);
});
