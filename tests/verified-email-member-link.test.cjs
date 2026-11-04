const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const {sharedAccess}=require('../trip-ui.js');

test('a verified linked account reuses an existing guest financial identity',()=>{
 const account={id:'verified-id',email:'example@example.com',is_anonymous:false};
 const members=[{user_id:'guest-financial-id',account_user_id:'verified-id',is_guest:false,can_edit:false}];
 assert.deepEqual(sharedAccess(account,{created_by:'another-id'},members),{
  signedIn:true,joined:true,canEdit:false,mode:'member'
 });
 members[0].can_edit=true;
 assert.equal(sharedAccess(account,{created_by:'another-id'},members).canEdit,true);
});
test('join-to-request removed; verified email claim form does not add new members',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.doesNotMatch(html,/id="joinSharedTripBtn"/);
 assert.doesNotMatch(app,/joinFromSharedView/);
 assert.match(html,/id="claimMemberForm"/);
 assert.match(html,/id="claimMemberEmail" type="email" required/);
 assert.match(app,/db\.rpc\('claim_existing_trip_member'/);
 assert.match(app,/email!==user\.email\.trim\(\)\.toLowerCase\(\)/);
 assert.match(app,/openSharedTrip\(code\)/);
 assert.match(app,/account_user_id\.eq\.'/);
});
test('Host can assign invitation email to an existing member',()=>{
 const app=read('app.js'),html=read('index.html');
 assert.match(html,/id="memberInviteEmail" type="email"/);
 assert.match(app,/get_trip_member_invite_emails/);
 assert.match(app,/update_trip_guest_invitation/);
 assert.match(app,/add_guest_member_with_email_and_fund/);
 assert.match(app,/memberInviteEmailField'\)\.classList\.toggle\('hidden',!mayAssignEmail\)/);
});
test('SQL links an authenticated verified email without rewriting financial references',()=>{
 const sql=read('verified_email_member_linking.sql');
 assert.match(sql,/account_user_id uuid/);
 assert.match(sql,/create schema if not exists trip_private/);
 assert.match(sql,/revoke all on trip_private\.member_email_invites/);
 assert.match(sql,/email_confirmed_at is not null and not is_anonymous/);
 assert.match(sql,/update public\.members set account_user_id=uid,is_guest=false/);
 assert.match(sql,/if owner_id<>auth\.uid\(\) then/);
 assert.doesNotMatch(sql,/update public\.member_debts set (debtor|creditor)_id/);
 assert.doesNotMatch(sql,/update public\.expenses set payer_id/);
 assert.doesNotMatch(sql,/update public\.contributions set payer_id/);
});
test('new backend restricts joining by an arbitrary share-link UUID',()=>{
 const sql=read('verified_email_member_linking.sql');
 assert.match(sql,/Ask the Host to link your verified email to an existing member/);
 assert.match(sql,/public\.is_trip_member\(trip_id\)/);
 assert.match(sql,/and can_edit/);
});
