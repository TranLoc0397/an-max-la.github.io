const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {memberPermissionView}=require('../trip-ui.js');

const host={id:'host',email:'host@example.test',is_anonymous:false};
const trip={id:'t1',created_by:'host'};
const hostRow={user_id:'host',name:'An',is_guest:false,can_edit:true};
const guest={user_id:'g1',name:'Bình',is_guest:true,can_edit:false};
const viewer={user_id:'u2',name:'Chi',is_guest:false,can_edit:false};
const editor={user_id:'u3',name:'Dũng',is_guest:false,can_edit:true};
const view=over=>memberPermissionView({trip,user:host,members:[hostRow,guest,viewer,editor],readOnly:false,editPermissionsReady:true,...over});

test('P01: Host with only manually added members sees the empty state',()=>{
 const v=view({members:[hostRow,guest]});
 assert.equal(v.showButton,true);
 assert.equal(v.showPanel,true);
 assert.equal(v.state,'empty');
 assert.deepEqual(v.rows,[]);
});

test('P02: non-Host members, anonymous viewers and read-only links never see the access controls',()=>{
 for(const user of [{id:'u2',email:'chi@example.test'},{id:'anon',is_anonymous:true},null]){
  const v=view({user});
  assert.equal(v.showButton,false,'button hidden for '+JSON.stringify(user));
  assert.equal(v.showPanel,false);
  assert.deepEqual(v.rows,[]);
 }
 const shared=view({readOnly:true});
 assert.equal(shared.showButton,false,'Host opening a view-only share link gets no access controls');
});

test('P05: Host sees signed-in members with their current access and the matching action',()=>{
 const v=view();
 assert.equal(v.state,'list');
 assert.deepEqual(v.rows,[
  {userId:'u2',name:'Chi',canEdit:false,status:'Chỉ xem',actionLabel:'Cấp quyền sửa',allow:true},
  {userId:'u3',name:'Dũng',canEdit:true,status:'Có quyền chỉnh sửa',actionLabel:'Thu hồi quyền',allow:false}
 ]);
});

test('the Host row and manually added guests are never listed',()=>{
 const ids=view().rows.map(r=>r.userId);
 assert.ok(!ids.includes('host'),'Host cannot revoke their own access');
 assert.ok(!ids.includes('g1'),'guests have no account to grant access to');
});

test('a guest who later claimed the record by verified email (is_guest=false) becomes grantable',()=>{
 const claimed={...guest,is_guest:false,account_user_id:'acc-9'};
 const v=view({members:[hostRow,claimed]});
 assert.deepEqual(v.rows.map(r=>[r.name,r.status]),[['Bình','Chỉ xem']]);
});

test('missing member_edit_permissions migration shows the install note instead of toggles',()=>{
 const v=view({editPermissionsReady:false});
 assert.equal(v.showButton,true);
 assert.equal(v.state,'migration');
 assert.deepEqual(v.rows,[]);
});

test('app.js renders the dialog from memberPermissionView and keeps the Host-only guards',()=>{
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.match(app,/TripTogetherUI\.memberPermissionView\(\{trip,user,members,readOnly,editPermissionsReady\}\)/);
 assert.match(app,/\$\('memberAccessBtn'\)\.classList\.toggle\('hidden',!permissionView\.showButton\)/);
 assert.match(app,/permissionPanel\.classList\.toggle\('hidden',!permissionView\.showPanel\)/);
 assert.match(app,/Chưa có thành viên nào đã liên kết tài khoản\./);
 assert.match(app,/if\(trip\?\.created_by!==user\?\.id\|\|readOnly\)return;\n \$\('memberAccessDialog'\)\.showModal\(\)/);
 assert.match(app,/async function toggleMemberEdit\(button\)\{if\(trip\?\.created_by!==user\?\.id\)return/);
 for(const id of ['memberAccessBtn','memberAccessDialog','editPermissionsPanel','memberPermissionList','memberAccessClose'])
  assert.match(html,new RegExp('id="'+id+'"'));
});

test('every Vietnamese string in the access dialog has an English translation',()=>{
 const i18n=fs.readFileSync(path.join(__dirname,'..','i18n.js'),'utf8');
 for(const vi of ['Quản lý quyền truy cập','Quyền chỉnh sửa thành viên','Chỉ thành viên đã liên kết tài khoản email mới hiện ở đây. Host có thể gắn email cho thành viên thủ công trong mục Sửa.','Chưa có thành viên nào đã liên kết tài khoản.','Chỉ xem','Có quyền chỉnh sửa','Cấp quyền sửa','Thu hồi quyền','Đóng'])
  assert.match(i18n,new RegExp('"'+vi.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'" *:'),'missing translation: '+vi);
});
