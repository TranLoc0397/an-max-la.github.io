const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('Host sees email-link action only for eligible unlinked guests',()=>{
 const app=read('app.js');
 assert.match(app,/m\.is_guest&&!m\.account_user_id&&memberInviteEmailsAvailable/);
 assert.match(app,/class="secondary compact link-member-email"/);
 assert.match(app,/openMemberEditor\(button\.dataset\.userId,true\)/);
});
test('Host member edit dialog always explains linked and ineligible accounts',()=>{
 const app=read('app.js'),html=read('index.html');
 assert.match(html,/id="memberAccountLinkStatus"/);
 assert.match(html,/id="memberAccountLinkStatusText"/);
 assert.match(html,/id="memberAccountLinkedEmail"/);
 assert.match(app,/const alreadyLinked=!!member\?\.account_user_id/);
 assert.match(app,/Đã liên kết tài khoản/);
 assert.match(app,/Không thể gán một email khác/);
 assert.match(app,/const canInvite=isHost&&memberInviteEmailsAvailable/);
});
test('email invitation reuses existing Host RPC; no new member is created for an edit',()=>{
 const app=read('app.js');
 assert.match(app,/update_trip_guest_invitation/);
 assert.match(app,/existing\?\.is_guest&&!existing\?\.account_user_id&&memberInviteEmailsAvailable/);
});
