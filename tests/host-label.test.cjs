const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
test('trip card shows Host, not the former Vietnamese owner label', () => {
  const app = read('app.js');
  assert.match(app, /isHost\?'♛ Host':'✓ Thành viên'/);
  assert.doesNotMatch(app, /♛ Chủ chuyến đi/);
});
test('app script and offline cache use refreshed versions', () => {
  const appVersion=Number(read('index.html').match(/app\\.js\\?v=(\\d+)/)?.[1]);
  const cacheVersion=Number(read('sw.js').match(/triptogether-v(\\d+)/)?.[1]);
  assert.ok(appVersion>=52,'app version must not regress below the Host label fix');
  assert.ok(cacheVersion>=63,'service worker cache must not regress');

});
