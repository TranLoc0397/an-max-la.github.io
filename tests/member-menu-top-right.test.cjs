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
