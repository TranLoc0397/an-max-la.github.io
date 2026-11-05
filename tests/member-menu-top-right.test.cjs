const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');

test('member settings stay aligned beside the name on mobile',()=>{
 const css=read('styles.css');
 assert.match(css,/\.member-row>\.member-edit-actions\{\s*position:absolute;\s*top:12px;\s*right:12px;/);
 assert.match(css, /@media\\(max-width:760px\\)\\{[\\s\\S]*?\\.member-row>\\.member-edit-actions\\{\\s*top:12px;\\s*right:12px;\\s*transform:none;/);
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

test('desktop member list uses four data columns without an empty settings column',()=>{
 const css=read('styles.css');
 assert.match(css,/@media\(min-width:761px\)\{[\s\S]*?\.member-table-head,\.member-row\{\s*grid-template-columns:minmax\(145px,1\.2fr\) repeat\(3,minmax\(86px,1fr\)\);\s*padding-right:68px;/);
 assert.doesNotMatch(css,/@media\(min-width:761px\)\{\.member-table-head,\.member-row\{[^}]*140px/);
 assert.match(css,/\.member-row>\.member-edit-actions\{position:absolute;top:12px;right:12px\}/);
 const html=read('index.html');
 assert.match(html,/class="member-table-head"><span>Thành viên<\/span><span>Đã chi cá nhân<\/span><span>Đã đóng quỹ<\/span><span>Phần chi<\/span>/);
});

test('desktop settings remain centered while mobile settings anchor to header',()=>{
 const css=read('styles.css');
 assert.match(css,/\.member-row>\.member-edit-actions\{top:50%;right:12px;transform:translateY\(-50%\)\}/);
 assert.match(css, /@media\\(max-width:760px\\)\\{[\\s\\S]*?\\.member-row>\\.item-title\\{\\s*box-sizing:border-box;\\s*min-height:52px;[\\s\\S]*?padding-right:56px;/);
 assert.match(css, /@media\\(max-width:760px\\)\\{[\\s\\S]*?\\.member-row>\\.member-edit-actions\\{\\s*top:12px;\\s*right:12px;\\s*transform:none;/);
 assert.match(css,/\.member-edit-actions \.member-actions-menu>summary\{[\s\S]*?width:40px;height:40px/);
});
