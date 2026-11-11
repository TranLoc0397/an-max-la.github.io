const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {formatDate,formatDateTime}=require('../trip-ui.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('calendar dates render as dd/mm/yyyy without a timezone shift',()=>{
 assert.equal(formatDate('2026-11-08'),'08/11/2026');
 assert.equal(formatDate('2026-01-01'),'01/01/2026');
 assert.equal(formatDateTime('2026-12-31'),'31/12/2026');
});

test('timestamps render in Vietnam time as dd/mm/yyyy HH:mm',()=>{
 // 17:30 UTC on 31 Dec is already 1 Jan 00:30 in Vietnam (UTC+7).
 assert.equal(formatDateTime('2026-12-31T17:30:00Z'),'01/01/2027 00:30');
 assert.equal(formatDate('2026-12-31T17:30:00Z'),'01/01/2027');
 assert.equal(formatDateTime('2026-11-11T02:29:06.123+00:00'),'11/11/2026 09:29');
 assert.equal(formatDateTime(new Date('2026-06-05T00:05:00Z')),'05/06/2026 07:05');
});

test('empty and invalid values never throw',()=>{
 assert.equal(formatDate(null),'');
 assert.equal(formatDate(''),'');
 assert.equal(formatDate(undefined),'');
 assert.equal(formatDateTime('not a date'),'not a date');
});

test('screens use the shared formatters instead of raw ISO dates or ad-hoc locale strings',()=>{
 const app=read('app.js'),shell=read('ui-shell.js');
 assert.doesNotMatch(app,/toLocale(Date)?String\('vi-VN',\{timeZone/);
 for(const field of ['spent_on','paid_on','incurred_on','due_on'])
  assert.doesNotMatch(app,new RegExp('esc\\((x|d|item|upcoming)\\.'+field+'\\)'),field+' must go through fmtDate');
 assert.match(app,/fmtDateTime\(event\.recorded_at\)/);
 assert.match(shell,/TripTogetherUI\.formatDate\(item\.spent_on\)/);
});
