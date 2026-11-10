const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('fund reminder and contribution actions use decorative SVGs with meaningful accessible names',()=>{
 const app=read('app.js');
 for(const field of ['edit-fund-reminder','delete-fund-reminder','edit-contribution','delete-contribution']){
  const button=app.match(new RegExp('<button[^>]*class="[^"]*'+field+'[^"]*"[^>]*>','g'));
  assert.ok(button&&button.length===1,'Expected exactly one action button: '+field);
  assert.match(button[0],/aria-label="[^"]+"/);
  assert.match(button[0],/title="[^"]+"/);
  assert.match(button[0],/type="button"/);
 }
 assert.match(app,/const FUND_EDIT_ICON='<svg[^']+aria-hidden="true"/);
 assert.match(app,/const FUND_REMOVE_ICON='<svg[^']+aria-hidden="true"/);
 assert.match(app,/>\$\{FUND_EDIT_ICON\}<\/button>/);
 assert.match(app,/>\$\{FUND_REMOVE_ICON\}<\/button>/);
});
test('fund action handlers and deletion confirmation remain in place',()=>{
 const app=read('app.js');
 assert.match(app,/querySelectorAll\('\.edit-fund-reminder'\)/);
 assert.match(app,/querySelectorAll\('\.delete-fund-reminder'\)/);
 assert.match(app,/querySelectorAll\('\.edit-contribution'\)/);
 assert.match(app,/querySelectorAll\('\.delete-contribution'\)/);
 assert.match(app,/removeRecord\('contributions'/);
 assert.match(app,/localizedConfirm\('Xóa nhắc thanh toán này\?'\)/);
});
test('fund icon actions have compact layout, keyboard focus, and mobile touch targets',()=>{
 const css=read('styles.css');
 assert.match(css,/\.fund-icon-btn:focus-visible/);
 assert.match(css,/\.fund-icon-edit\{/);
 assert.match(css,/\.fund-icon-remove\{/);
 assert.match(css,/\.fund-reminder-panel \.fund-reminder-row\{/);
 assert.match(css,/#contributionList \.record-row/);
 assert.match(css,/min-height:40px/);
 assert.match(css,/@container ledger \(max-width:590px\)/);
});
