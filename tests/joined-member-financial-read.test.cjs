const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('read-only RLS policies grant only trip-member SELECT, not financial writes',()=>{
 const sql=read('fix_joined_member_financial_read.sql');
 for(const table of ['expenses','contributions','member_debts']){
  assert.match(sql,new RegExp('on public\\.'+table+' for select to authenticated'));
 }
 assert.equal((sql.match(/using \(public\.is_trip_member\(trip_id\)\)/g)||[]).length,3);
 const statements=sql.split('\\n').filter(line=>!line.trim().startsWith('--')).join('\\n');
 assert.doesNotMatch(statements,/for (insert|update|delete)|drop policy|update public\\.|delete from public\\./i);
});
test('empty joined read-only results are verified against invite-link data before being shown',()=>{
 const app=read('app.js');
 assert.match(app,/const isReadOnlyMember=!!joinedMember&&!joinedMember\.can_edit/);
 assert.match(app,/nextExpenses\.length===0&&nextContributions\.length===0&&nextDebts\.length===0/);
 assert.match(app,/db\.rpc\('get_shared_trip',\{p_invite_code:trip\.invite_code/);
 assert.match(app,/nextExpenses=data\.expenses\|\|\[\]/);
 assert.match(app,/if\(!current\(\)\)return;/);
 assert.match(app,/render\(\);status\(usedSharedFallback/);
});
test('existing permission and financial code is preserved',()=>{
 const app=read('app.js');
 assert.match(app,/TripTogetherFinance\.calculateTotals/);
 assert.match(app,/syncEditPermissions\(\)/);
 assert.match(app,/record_trip_payment/);
 assert.match(app,/remove_trip_member_safe/);
});
