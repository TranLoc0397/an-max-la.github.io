const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');

test('member menu is at the top-right next to the name at every viewport',()=>{
 const css=read('styles.css');
 assert.match(css,/\.member-row>\.member-edit-actions\{\s*position:absolute;\s*top:12px;\s*right:12px;/);
 assert.match(css,/\.member-row>\.item-title\{padding-right:56px/);
 assert.match(css,/@media\(max-width:520px\)\{\s*\.member-row>\.member-edit-actions\{top:12px;right:12px/);
 assert.match(css,/\.member-actions-menu>summary\{\s*display:flex;\s*width:44px;\s*height:44px/);
});
test('menu explicitly handles taps, preserving all existing action callbacks',()=>{
 const js=read('app.js');
 assert.match(js,/menu\.querySelector\('summary'\)\?\.addEventListener\('click',event=>\{/);
 assert.match(js,/event\.preventDefault\(\);\s*menu\.open=!menu\.open/);
 for(const action of ['edit-member','link-member-email','merge-member','remove-member']){
  assert.match(js,new RegExp("querySelectorAll\\('\\."+action+"'" ));
 }
});

test('three-dot menu uses one accessible SVG icon and consistent dimensions',()=>{
 const app=read('app.js'),css=read('styles.css');
 assert.match(app,/<svg class="member-menu-icon" viewBox="0 0 24 24"/);
 for(const x of [5,12,19])assert.match(app,new RegExp('cx="'+x+'" cy="12" r="1\\.8"'));
 assert.match(app,/aria-label="Thao tác thành viên:/);
 assert.match(css,/\.member-edit-actions \.member-actions-menu>summary\{[\s\S]*?width:44px;[\s\S]*?height:44px;/);
 assert.match(css,/\.member-actions-menu>summary \.member-menu-icon\{/);
});
