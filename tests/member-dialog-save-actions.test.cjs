const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('member save is a standard submit action, never an implicit dialog close',()=>{
 const html=read('index.html');
 assert.match(html,/<dialog id="memberDialog"><form id="memberForm">/);
 assert.match(html,/<button class="primary" id="memberSave" type="submit">/);
 assert.match(html,/<button class="secondary" id="memberCancel" type="button">/);
 assert.doesNotMatch(html,/<dialog id="memberDialog"><form method="dialog"/);
});
test('member form prevents native submission for all submit paths, including Enter',()=>{
 const app=read('app.js');
 const start=app.indexOf("$('memberForm').addEventListener('submit'");
 const end=app.indexOf("$('expenseForm').addEventListener('submit'",start);
 assert.ok(start>0&&end>start);
 const block=app.slice(start,end);
 assert.match(block,/ev\.preventDefault\(\)/);
 assert.doesNotMatch(block,/ev\.submitter\?\.id!==/);
 assert.match(block,/if\(actionInFlight\)return/);
 assert.match(block,/quyền chỉnh sửa/);
 assert.match(block,/add_guest_member_with_fund/);
 assert.match(block,/update_trip_member_name/);
});
