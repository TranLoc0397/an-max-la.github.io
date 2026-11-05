const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('airport layer stays decorative, behind app, at approved 22% opacity', () => {
 const html = read('index.html');
 const css = read('airport-background.css');
 assert.match(html, /<div class="airport-scene" aria-hidden="true">/);
 assert.ok(html.indexOf('class="airport-scene"') < html.indexOf('id="pageLoader"'));
 assert.match(html, /<link rel="stylesheet" href="airport-background.css\?v=1">/);
 assert.match(css, /--airport-opacity:\.22/);
 assert.match(css, /\.airport-scene\{[\s\S]*?position:fixed;[\s\S]*?z-index:-1;[\s\S]*?pointer-events:none/);
 assert.match(css, /\.airport-visual\{[^}]*opacity:var\(--airport-opacity\)/);
});

test('animated airport includes moving aircraft, ground vehicle and reduced motion', () => {
 const html = read('index.html');
 const css = read('airport-background.css');
 for (const token of ['airport-plane-one','airport-plane-two','airport-plane-three','airport-shuttle','airport-radar']) {
   assert.ok(html.includes(token), 'Missing '+token);
 }
 assert.match(css, /@keyframes airport-travel/);
 assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css, /animation:none!important/);
});

test('service worker caches the airport stylesheet for offline sessions', () => {
 const sw = read('sw.js');
 assert.match(sw, /'\.\/airport-background\.css'/);
});
