const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
test('creating a member without an invited email uses the installed fund RPC',()=>{
 assert.match(app,/isHost&&email\s*\?await db\.rpc\('add_guest_member_with_email_and_fund'/);
 assert.match(app,/:await db\.rpc\('add_guest_member_with_fund',\{p_trip_id:tripId,p_name:name,p_amount:amount\}/);
});
test('missing optional email invitation RPC does not block refresh',()=>{
 assert.match(app,/if\(a\.error\|\|b\.error\|\|c\.error\|\|d\.error\|\|ledger\.error\|\|history\.error\)/);
 assert.doesNotMatch(app,/\|\|invites\.error\)\{status\('Sync error'\)/);
 assert.match(app,/memberInviteEmailsAvailable=!invites\.error/);
 assert.match(app,/const canInvite=isHost&&memberInviteEmailsAvailable/);
});
test('renaming existing members uses installed RPC before email migration',()=>{
 assert.match(app,/existing\?\.is_guest&&!existing\?\.account_user_id&&memberInviteEmailsAvailable/);
 assert.match(app,/update_trip_member_name/);
});
