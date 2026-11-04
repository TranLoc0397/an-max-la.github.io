const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('account dialog actions have consistent full-width layout',()=>{
 const css=read('styles.css');
 for(const selector of ['#accountDialog .account-form .account-submit','#accountDialog #accountLogout','#accountDialog #accountClose'])assert.ok(css.includes(selector),selector);
 assert.match(css,/#accountDialog #accountLogout\{[\s\S]*?width:100%/);
 assert.match(css,/#accountDialog #accountClose\{[\s\S]*?width:100%/);
 assert.match(css,/#accountDialog \.account-dialog-content>menu\{[\s\S]*?display:block/);
});
test('account dialog preserves existing buttons and safe auth flows',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.match(html,/id="accountDialog"/);
 assert.match(html,/id="accountClose"/);
 for(const name of ['accountPasswordSave','accountLogout','accountLoginSave','accountRegisterSave'])assert.match(app,new RegExp(name));
 assert.match(app,/auth\.updateUser\(\{password\}\)/);
 assert.match(app,/auth\.signOut/);
});
test('mobile layout uses comfortable hit targets and respects reduced motion',()=>{
 const css=read('styles.css');
 assert.match(css,/#accountDialog #accountLogout,\s*#accountDialog #accountClose\{min-height:46px\}/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('account dialog closes itself shortly after the password is saved',()=>{
 const app=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
 const i=app.indexOf("accountNotice('Đã lưu mật khẩu.");
 assert.ok(i>0);
 assert.match(app.slice(i,i+300),/setTimeout\(\(\)=>\{if\(\$\('accountDialog'\)\.open\)\$\('accountDialog'\)\.close\(\)\},1600\)/);
});
