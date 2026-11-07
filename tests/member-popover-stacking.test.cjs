const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('open member menu lifts its whole row above other settings buttons',()=>{
 const css=read('styles.css'),js=read('app.js');
 assert.match(css,/#memberList \.member-row\.member-menu-open/);
 assert.match(css,/z-index:150!important/);
 assert.match(css,/#memberList \.member-actions-menu\[open\]>.member-actions-dropdown\{z-index:200\}/);
 assert.match(js,/menu\.closest\('\.member-row'\)\?\.classList\.toggle\('member-menu-open',menu\.open\)/);
 assert.match(js,/if\(menu\.open\)\$\('memberList'\)\.querySelectorAll/);
});
test('the header trip button is gone without removing sidebar navigation',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.doesNotMatch(html,/id="tripListNavTop"/);
 assert.doesNotMatch(app,/tripListNavTop/);
 assert.match(html,/id="tripListNavSide"/);
 assert.match(app,/tripListNavSide'\)\.addEventListener\('click',openTripList\)/);
});
