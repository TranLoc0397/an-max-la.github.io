const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');

test('member settings stay aligned at the top-right on mobile',()=>{
 const css=read('styles.css');
 assert.match(css,/\.member-row>\.member-edit-actions\{\s*position:absolute;\s*top:12px;\s*right:12px;/);
 assert.match(css,/@media\(max-width:520px\)\{\s*\.member-row>\.member-edit-actions\{top:12px;right:12px/);
 assert.match(css,/\.member-edit-actions \.member-actions-menu>summary\{[\s\S]*?width:40px;height:40px;min-width:40px;min-height:40px/);
});

test('settings menu handles taps and keeps existing actions',()=>{
 const js=read('app.js');
 assert.match(js,/menu\.querySelector\('summary'\)\?\.addEventListener\('click',event=>\{/);
 assert.match(js,/event\.preventDefault\(\);\s*menu\.open=!menu\.open/);
 for(const action of ['edit-member','link-member-email','merge-member','remove-member']){
  assert.match(js,new RegExp("querySelectorAll\\('\\."+action+"'"));
 }
});

test('a single accessible settings icon replaces dots',()=>{
 const js=read('app.js');
 assert.match(js,/<svg class="member-menu-icon" viewBox="0 0 24 24"/);
 assert.match(js,/<circle cx="12" cy="12" r="3"\/>/);
 assert.match(js,/aria-label="Thao tác thành viên:/);
 assert.match(js,/title="Cài đặt thành viên"/);
 assert.doesNotMatch(js,/<circle cx="5" cy="12" r="1\.8"\/>/);
});

test('name, Host badge, and actions remain on a single line',()=>{
 const js=read('app.js'),css=read('styles.css');
 assert.match(js,/class="member-name-line"/);
 assert.match(js,/class="member-display-name"/);
 assert.match(css,/\.member-name-line\{[^}]*white-space:nowrap/);
 assert.match(css,/\.member-display-name\{[^}]*text-overflow:ellipsis;white-space:nowrap/);
 assert.match(css,/\.member-name-line \.creator-label\{[^}]*white-space:nowrap/);
 assert.match(css,/\.member-actions-dropdown button,\.member-edit-actions \.member-actions-dropdown \.compact\{[^}]*white-space:nowrap/);
});
