const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('member row has compact accessible three-dot menu retaining all actions',()=>{
 const js=read('app.js');
 assert.match(js,/<details class="member-actions-menu">/);
 assert.match(js,/<summary aria-label="Thao tác thành viên: /);
 assert.match(js,/class="member-actions-dropdown"/);
 for(const action of ['edit-member','link-member-email','merge-member','remove-member'])
  assert.match(js,new RegExp('class="[^"]*'+action+'"'));
 assert.match(js,/m\.is_guest&&!m\.account_user_id&&memberInviteEmailsAvailable/);
 assert.match(js,/m\.id!==trip\.created_by/);
});
test('menu closes when action selected, outside tapped or Escape pressed',()=>{
 const js=read('app.js');
 assert.match(js,/menu\.querySelectorAll\('button'\)/);
 assert.match(js,/menu\.open=false/);
 assert.match(js,/document\.addEventListener\('pointerdown'/);
 assert.match(js,/document\.addEventListener\('keydown'/);
 assert.match(js,/event\.key!=='Escape'/);
});
test('overflow menu is responsive and positioned over content',()=>{
 const css=read('styles.css');
 assert.match(css,/\.member-row:has\(\.member-actions-menu\[open\]\)/);
 assert.match(css,/\.member-actions-dropdown\{position:absolute/);
 assert.match(css,/\.member-row:last-child \.member-actions-dropdown/);
 assert.match(css,/summary:focus-visible/);
});
