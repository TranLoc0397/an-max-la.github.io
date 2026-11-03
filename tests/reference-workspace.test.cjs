const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('welcome and workspace reference components retain existing real actions',()=>{
 const html=read('index.html');
 for(const id of ['welcome','createBtn','joinCode','joinBtn','savedTripList','createTripCardButton','noSavedTrips'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/class="tt-welcome-hero"/);
 assert.match(html,/class="tt-trip-cards"/);
 assert.match(html,/class="tt-invite-workspace"/);
 assert.match(html,/id="tripTitleDialog"/);
 assert.match(html,/id="accountDialog"/);
});

test('trip cards render from Supabase trip query, not hard-coded demo data',()=>{
 const app=read('app.js');
 assert.match(app,/\.from\('trips'\)\.select\('id,name,created_at,created_by'\)/);
 assert.match(app,/\(trips\|\|\[\]\)\.map\(\(t,i\)=>/);
 assert.match(app,/esc\(t\.name\)/);
 assert.match(app,/isHost=t\.created_by===user\.id/);
 assert.match(app,/withButtonLoading\(button,'Opening…',\(\)=>joinTrip\(button\.dataset\.tripId,false\)\)/);
});

test('new create controls reuse authenticated create-trip flow',()=>{
 const app=read('app.js');
 assert.match(app,/createTripCardButton'\)\.onclick=\(\)=>\$\('createBtn'\)\.click\(\)/);
 assert.match(app,/createTripTile'\).*createBtn'\)/);
 assert.match(app,/function canCreateTrip\(/);
 assert.match(app,/\.from\('trips'\)\.insert\(/);
 assert.match(app,/db\.rpc\('join_trip'/);
});

test('reference styles remain responsive, Roboto, and reduced motion compatible',()=>{
 const css=read('styles.css');
 assert.match(css,/\.tt-welcome-hero\{/);
 assert.match(css,/\.tt-trip-create-tile\{/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/Roboto/);
});
test('existing payment, permissions and financial logic preserved',()=>{
 const app=read('app.js');
 assert.match(app,/TripTogetherFinance\.calculateTotals/);
 assert.match(app,/record_trip_payment/);
 assert.match(app,/get_shared_trip/);
 assert.match(app,/remove_trip_member_safe/);
});
