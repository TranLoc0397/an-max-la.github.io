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
  assert.match(read('index.html'), /app\.js\?v=52/);
  assert.match(read('sw.js'), /triptogether-v63/);
});
