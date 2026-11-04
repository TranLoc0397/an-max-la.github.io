const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('Host sees merge action for non-Host members only, inside the row overflow menu',()=>{
 const app=read('app.js');
 assert.match(app,/class="secondary compact merge-member"/);
 assert.match(app,/trip\.created_by===user\?\.id&&m\.id!==trip\.created_by/);
 assert.match(app,/openMergeMemberDialog\(button\.dataset\.userId\)/);
 assert.match(app,/if\(readOnly\|\|trip\?\.created_by!==user\?\.id\)return/);
 const menu=app.slice(app.indexOf('<details class="member-actions-menu">'));
 assert.ok(menu.indexOf('merge-member')>0&&menu.indexOf('merge-member')<menu.indexOf('</details>'),'merge must live inside the overflow menu, not as a row button');
 assert.doesNotMatch(read('index.html'),/memberMergeField/,'no duplicate merge entry point in the edit dialog');
});

test('merge requires explicit target, checkbox and final confirmation',()=>{
 const html=read('index.html'),app=read('app.js');
 for(const id of ['mergeMemberDialog','mergeMemberForm','mergeSourceId','mergeTargetId','mergeMemberAcknowledge','mergeMemberSave'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/id="mergeMemberAcknowledge" type="checkbox" required/);
 assert.match(app,/if\(!localizedConfirm\('Hợp nhất/);
 assert.match(app,/merge_duplicate_trip_members/);
 assert.match(app,/p_source_user_id:sourceId,p_target_user_id:targetId/);
});

test('merge RPC is Host-only, atomic, and preserves financial amounts',()=>{
 const sql=read('merge_duplicate_trip_members.sql');
 assert.match(sql,/actor<>host_id/);
 assert.match(sql,/p_source_user_id=host_id or p_target_user_id=host_id/);
 assert.match(sql,/if not source_member\.is_guest and not target_member\.is_guest/);
 assert.match(sql,/Cannot merge: these members have a personal debt between them/);
 assert.match(sql,/update public\.expenses\s+set payer_id=p_target_user_id,payer_name=target_member\.name/);
 assert.match(sql,/update public\.contributions\s+set payer_id=p_target_user_id,payer_name=target_member\.name/);
 assert.match(sql,/update public\.member_debts/);
 assert.match(sql,/update public\.members\s+set account_user_id=source_login/);
 assert.match(sql,/delete from public\.members\s+where trip_id=p_trip_id and user_id=p_source_user_id/);
 assert.doesNotMatch(sql,/delete from public\.(expenses|contributions|member_debts|trip_payments)/);
 assert.doesNotMatch(sql,/update public\.(expenses|contributions|member_debts)\s+set amount/);
 assert.match(sql,/grant execute on function public\.merge_duplicate_trip_members\(uuid,uuid,uuid\)\s+to authenticated/);
});

test('existing remove-member guard still blocks deletion of members with transactions',()=>{
 const app=read('app.js');
 assert.match(app,/if\(connected\)\{localizedAlert\('Không thể xóa thành viên có giao dịch/);
 assert.match(app,/remove_trip_member_safe/);
});

test('missing merge RPC shows an install hint instead of the raw PostgREST error',()=>{
 const app=read('app.js');
 assert.match(app,/error\?\.code==='PGRST202'\|\|\/Could not find the function\/i/);
 assert.match(app,/Tính năng hợp nhất chưa được cài trên máy chủ/);
});
