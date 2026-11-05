const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('brand assets use approved purple car and coin logo',()=>{
 const svg=read('triptogether-purple-icon.svg');
 assert.match(svg,/TripTogether: car, journey and shared expenses/);
 assert.match(svg,/id="gold"/);
 assert.match(svg,/id="car"/);
 assert.doesNotMatch(svg,/data:image\/png;base64/);
});

test('header, sidebar, favicon and mobile icon point to updated logo',()=>{
 const html=read('index.html');
 assert.match(html,/<link rel="icon" href="triptogether-purple-icon.png\?v=2"/);
 assert.match(html,/<link rel="apple-touch-icon" href="triptogether-purple-icon.png\?v=2"/);
 assert.match(html,/<link rel="manifest" href="manifest.webmanifest\?v=2"/);
 assert.match(html,/class="brand-icon"><img src="triptogether-purple-icon.png\?v=2"/);
 assert.match(html,/class="tt-sidebar-brand"[^>]*><img src="triptogether-purple-icon.png\?v=2"/);
 const manifest=JSON.parse(read('manifest.webmanifest'));
 assert.ok(manifest.icons.some(x=>x.src==='triptogether-purple-icon.png?v=2'&&x.type==='image/png'));
 assert.ok(manifest.icons.some(x=>x.src==='triptogether-purple-icon.svg?v=2'&&x.type==='image/svg+xml'));
 const sw=read('sw.js');
 assert.match(sw, /'\.\/triptogether-purple-icon.png'/);
 assert.match(sw, /'\.\/triptogether-purple-icon.svg'/);
});
