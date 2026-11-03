const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {sharedAccess}=require('../trip-ui.js');

const host='host-id',editor='editor-id',viewer='viewer-id';
const trip={id:'trip-id',created_by:host};
const members=[
 {user_id:host,can_edit:true},
 {user_id:editor,can_edit:true},
 {user_id:viewer,can_edit:false}
];
const account=id=>({id,email:id+'@example.test',is_anonymous:false});

test('Host opens shared link with editing access',()=>{
 assert.deepEqual(sharedAccess(account(host),trip,members),{signedIn:true,joined:true,canEdit:true,mode:'editor'});
});
test('Joined editor opens with editing access',()=>{
 assert.deepEqual(sharedAccess(account(editor),trip,members),{signedIn:true,joined:true,canEdit:true,mode:'editor'});
});
test('Joined view-only member does not receive edit access',()=>{
 assert.deepEqual(sharedAccess(account(viewer),trip,members),{signedIn:true,joined:true,canEdit:false,mode:'member'});
});
test('Signed in email account without membership remains view-only and is not prompted to sign in again',()=>{
 assert.deepEqual(sharedAccess(account('outsider'),trip,members),{signedIn:true,joined:false,canEdit:false,mode:'signed-in-viewer'});
});
test('Anonymous session requires login or joining and cannot edit',()=>{
 assert.deepEqual(sharedAccess({id:'anonymous-id',is_anonymous:true},trip,members),{signedIn:false,joined:false,canEdit:false,mode:'guest-viewer'});
});
test('Email text does not confer membership without matching authenticated id',()=>{
 assert.equal(sharedAccess({id:'different-id',email:'host@example.test',is_anonymous:false},trip,members).canEdit,false);
});
test('Shared access markup and scripts support contextual actions',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
 assert.match(html,/id="sharedAccessDescription"/);
 assert.match(js,/sharedAccess\(user,data.trip,data.members\|\|\[\]\)/);
 assert.match(js,/sharedAccountBtn'\)\.classList\.toggle\('hidden',access\.signedIn\)/);
 assert.match(css,/\.shared-access-actions\{display:flex/);
 assert.match(css,/gap:12px/);
});
