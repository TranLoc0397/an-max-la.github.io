const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('reference dashboard has live-data slots, not hard-coded demo balances',()=>{
 const html=read('index.html');
 for(const id of ['ttOverview','ttRecentExpenses','ttRecentMembers','ttOverviewNetFund','ttSidebar','ttMobileNav'])
   assert.match(html,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(html,/8\.450\.000|12\.800\.000|Phương Văn|demo1234/);
});
test('navigation maps to existing tabs and uses their click actions',()=>{
 const shell=read('ui-shell.js');
 const app=read('app.js');
 assert.match(shell,/tab\?\.click\(\)/);
 assert.match(app,/window\.TripTogetherShell\?\.openTrip\(\)/);
 assert.match(app,/window\.TripTogetherShell\?\.render\(/);
 assert.match(app,/window\.TripTogetherShell\?\.closeTrip\(\)/);
});
test('quick expense action reuses existing form and respects editor permission',()=>{
 const shell=read('ui-shell.js');
 assert.match(shell,/button\.disabled=!canEdit/);
 assert.match(shell,/add\.click\(\)/);
 assert.match(shell,/if\(add&&!add\.classList\.contains\('hidden'\)&&!add\.disabled\)/);
});
test('responsive navigation, mobile safe areas and reduced-motion support exist',()=>{
 const css=read('styles.css');
 assert.match(css,/body\.tt-trip-open \.tt-mobile-nav\{display:grid\}/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.tt-overview-grid\{display:grid/);
});
test('Supabase and finance remain in unchanged app architecture',()=>{
 const app=read('app.js');
 assert.match(app,/get_shared_trip/);
 assert.match(app,/TripTogetherFinance\.calculateTotals/);
 assert.match(app,/record_trip_payment/);
});
