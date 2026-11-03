const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const finance=require('../finance.js');
const root=path.join(__dirname,'..');
test('member balance retains guest status without changing money',()=>{
 const members=[{user_id:'host',name:'Host',is_guest:false},{user_id:'guest',name:'Guest',is_guest:true}];
 const totals=finance.calculateTotals({initial_fund:0},[{amount:400,payer_id:null}],[]);
 const balances=finance.calculateMemberBalances(members,[{amount:400,payer_id:null}],[],totals);
 assert.equal(balances[0].is_guest,false);
 assert.equal(balances[1].is_guest,true);
 assert.deepEqual(balances.map(x=>x.b),[0,0]);
});
test('member page excludes the two bulky permission panels',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const people=html.split('<section id="peopleTab"')[1].split('</section>')[0];
 assert.doesNotMatch(people,/id="hostEditRequestsPanel"/);
 assert.doesNotMatch(people,/id="editPermissionsPanel"/);
 assert.match(html,/id="memberAccessDialog"/);
 assert.match(html,/id="memberAccessBtn"/);
 assert.match(html,/id="memberEditUserId"/);
});
test('safe deletion SQL has explicit finance and Host guards',()=>{
 const sql=fs.readFileSync(path.join(root,'member_management.sql'),'utf8');
 assert.match(sql,/Cannot remove the trip Host/);
 assert.match(sql,/from public\.expenses/);
 assert.match(sql,/from public\.contributions/);
 assert.match(sql,/from public\.member_debts/);
 assert.match(sql,/from public\.trip_payments/);
 assert.match(sql,/public\.can_edit_trip\(p_trip_id\)/);
});
test('member controls are protected by canEdit and mobile style rules',()=>{
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const styles=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 assert.match(app,/canEdit\?\x60<div class="member-edit-actions"/);
 assert.match(app,/remove_trip_member_safe/);
 assert.match(app,/update_trip_member_name/);
 assert.match(styles,/@media\(max-width:520px\)/);
 assert.match(styles,/\.member-actions/);
});
