const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('trip list has explicit accessible navigation in header and sidebar',()=>{
 const html=read('index.html');
 assert.match(html,/<button type="button" id="tripListNavTop"[^>]*aria-label="Danh sách chuyến đi"/);
 assert.match(html,/<button type="button" id="tripListNavSide"[^>]*aria-label="Danh sách chuyến đi"/);
 assert.match(html,/id="savedTripList"/);
});
test('trip list navigation preserves membership and uses trip cleanup',()=>{
 const app=read('app.js');
 assert.match(app,/async function openTripList\(\)/);
 assert.match(app,/await closeTripView\(\)/);
 assert.match(app,/tripListNavTop'\)\.addEventListener\('click',openTripList\)/);
 assert.match(app,/tripListNavSide'\)\.addEventListener\('click',openTripList\)/);
 assert.match(app,/tripListNavTop'\)\.classList\.remove\('hidden'\)/);
 assert.match(app,/tripListNavTop'\)\.classList\.add\('hidden'\)/);
 const part=app.slice(app.indexOf('async function openTripList()'),app.indexOf('async function closeTripView()'));
 assert.doesNotMatch(part,/leave_trip|delete_trip|remove_trip_member/);
});
test('Host card badge icon and text have deliberate gap and remain responsive',()=>{
 const app=read('app.js'),css=read('styles.css');
 assert.match(app,/tt-trip-role/);
 assert.match(app,/TTIcon\('crown'\)\+' Host'/);
 assert.match(css,/\.tt-trip-card-body \.tt-trip-role\{align-items:center;gap:9px/);
 assert.match(css,/\.tt-trip-card-body \.tt-trip-role \.tt-icon/);
 assert.match(css,/@media\(max-width:380px\)/);
});
test('My trips navigation supports translation and cache reload',()=>{
 const i18n=read('i18n.js'),html=read('index.html'),sw=read('sw.js');
 assert.match(i18n,/"Danh sách chuyến đi":"My trips"/);
 assert.match(html,/app\.js\?v=75/);
 assert.match(sw,/const CACHE='triptogether-v102'/);
});
