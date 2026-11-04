const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('view-only share page has no join-to-request button or join callback',()=>{
 const html=read('index.html'),js=read('app.js');
 assert.doesNotMatch(html,/id="joinSharedTripBtn"/);
 assert.doesNotMatch(js,/joinFromSharedView|joinSharedTripBtn/);
 assert.match(html,/id="sharedAccountBtn"/);
 assert.match(js,/openSharedTrip\(code\)/);
 assert.match(js,/get_shared_trip/);
});
test('manual trip-code action opens a shared viewer, never joins a new member',()=>{
 const js=read('app.js');
 const start=js.indexOf("$('joinBtn').onclick");
 const end=js.indexOf("async function openSharedTrip(",start);
 assert.ok(start>=0&&end>start);
 const action=js.slice(start,end);
 assert.match(action,/openSharedTrip\(code\)/);
 assert.doesNotMatch(action,/joinTrip\(code,true\)|askName/);
});
test('backend prevents member creation from shared link but allows Host initialization',()=>{
 const sql=read('disable_shared_link_member_join.sql');
 assert.match(sql,/if owner_id<>auth\.uid\(\) then/);
 assert.match(sql,/Joining by shared link is disabled/);
 assert.match(sql,/if exists\(select 1 from public\.members/);
 assert.match(sql,/insert into public\.members/);
 assert.doesNotMatch(sql,/delete from public\.members|update public\.expenses|update public\.contributions/i);
});
