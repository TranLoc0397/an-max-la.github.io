const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('member creation offers optional opening contribution; editing hides it',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.match(html,/id="memberOpeningFundField"/);
 assert.match(html,/id="memberOpeningFund" data-money type="text" inputmode="numeric" min="0"/);
 assert.match(app,/memberOpeningFundField'\)\.classList\.toggle\('hidden',!!member\)/);
 assert.match(app,/memberEditUserId/);
});
test('optional contribution uses a single atomic database RPC',()=>{
 const app=read('app.js'),sql=read('add_member_with_fund.sql');
 assert.match(app,/add_guest_member_with_fund/);
 assert.match(app,/amountText===''\?0:Number\(amountText\)/);
 assert.match(app,/Number\.isSafeInteger\(amount\)/);
 assert.match(sql,/public\.can_edit_trip\(p_trip_id\)/);
 assert.match(sql,/insert into public\.members/);
 assert.match(sql,/if p_amount > 0 then/);
 assert.match(sql,/insert into public\.contributions/);
 assert.match(sql,/payer_id, payer_name, amount, note, paid_on, created_by/);
 assert.match(sql,/Asia\/Ho_Chi_Minh/);
 assert.match(sql,/revoke all on function public\.add_guest_member_with_fund/);
});
test('footer keeps status on its own row with two balanced action buttons on mobile',()=>{
 const html=read('index.html'),css=read('styles.css');
 assert.match(html,/id="syncStatus"/);
 assert.match(html,/class="footer-actions"/);
 assert.match(html,/id="deleteTripBtn"/);
 assert.match(html,/id="leaveBtn"/);
 assert.match(css,/#app > footer #syncStatus/);
 assert.match(css,/#app > footer \.footer-actions\{\s*grid-column:1;\s*display:grid;/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:650px\)/);
});
test('edit, financial and authentication paths are retained',()=>{
 const app=read('app.js');
 assert.match(app,/update_trip_member_name/);
 assert.match(app,/TripTogetherFinance\.calculateTotals/);
 assert.match(app,/record_trip_payment/);
 assert.match(app,/remove_trip_member_safe/);
});
