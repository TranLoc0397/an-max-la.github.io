const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('new supplied purple logo appears in header, desktop sidebar and favicon',()=>{
 const html=read('index.html');
 assert.match(html,/class="brand-icon"><img src="triptogether-purple-icon\.svg\?v=1"/);
 assert.match(html,/class="tt-sidebar-brand"/);
 assert.match(html,/rel="icon" href="triptogether-purple-icon\.svg\?v=1"/);
 assert.match(html,/rel="apple-touch-icon" href="triptogether-purple-icon\.png\?v=1"/);
});
test('PWA metadata and offline precache use purple mark',()=>{
 const manifest=JSON.parse(read('manifest.webmanifest'));
 const sw=read('sw.js');
 assert.equal(manifest.theme_color,'#6559e8');
 assert.equal(manifest.icons[0].src,'triptogether-purple-icon.png?v=1');
 assert.match(sw,/triptogether-purple-icon\.svg/);
 assert.match(sw,/triptogether-purple-icon\.png/);
});
test('transparent supplied image remains embedded and valid PNG in SVG',()=>{
 const svg=read('triptogether-purple-icon.svg');
 const encoded=svg.match(/data:image\/png;base64,([^"]+)/)?.[1];
 assert.ok(encoded,'SVG should include the optimized supplied purple icon');
 const png=Buffer.from(encoded,'base64');
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),64);
 assert.equal(png.readUInt32BE(20),64);
});
test('purple accent typography replaces legacy green brand text',()=>{
 const css=read('styles.css');
 assert.match(css,/--teal:#6559e8/);
 assert.match(css,/\.tt-fund-highlight\{color:#6559e8\}/);
 assert.match(css,/\.record-status,\.member-diff-positive/);
 assert.match(css,/\.account-feedback-success\{background:#f1efff;color:#5045c9\}/);
 assert.match(css,/\.tt-sidebar-brand\{/);
 assert.match(css,/\.primary\{background:linear-gradient\(130deg,#7567ed,#5849d7\)/);
});
test('business logic and Supabase schema remain untouched',()=>{
 const app=read('app.js');
 assert.match(app,/TripTogetherFinance\.calculateTotals/);
 assert.match(app,/record_trip_payment/);
 assert.match(app,/get_shared_trip/);
});
