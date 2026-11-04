/* Pure UI selectors: free from Supabase and DOM, reusable in tests. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TripTogetherUI=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 function filterExpenses(expenses,options={}){
  const query=String(options.query||'').trim().toLocaleLowerCase('vi');
  const category=String(options.category||''),status=String(options.status||'');
  return expenses.filter(item=>{
   const amount=Number(item.amount);
   const paid=Math.max(0,Math.min(amount,Number(item.paid_amount==null?(item.reimbursed?amount:0):item.paid_amount)));
   const due=amount-paid;
   const text=!query||[item.title,item.note,item.payer_name,item.category]
     .some(value=>String(value||'').toLocaleLowerCase('vi').includes(query));
   const matchStatus=!status||
     (status==='due'&&!!item.payer_id&&due>0&&paid===0)||
     (status==='partial'&&!!item.payer_id&&due>0&&paid>0)||
     (status==='paid'&&(!item.payer_id||due===0));
   return text&&(!category||(item.category||'Khác')===category)&&matchStatus;
  });
 }
 function sharedAccess(user,trip,members=[]){
   const signedIn=!!(user&&user.email&&!user.is_anonymous);
   const owner=!!(user?.id&&trip?.created_by===user.id);
   const member=members.find(m=>m.user_id===user?.id||m.account_user_id===user?.id);
   const joined=owner||!!member;
   const canEdit=owner||!!member?.can_edit;
   return {
     signedIn,joined,canEdit,
     mode:joined?(canEdit?'editor':'member'):signedIn?'signed-in-viewer':'guest-viewer'
   };
 }

 // What the Host's "Quản lý quyền truy cập" dialog shows. Pure: no DOM, no Supabase.
 // Only members who signed in with an account (not manually added guests) can be granted edit access.
 function memberPermissionView({trip,user,members=[],readOnly=false,editPermissionsReady=false}={}){
   const isHost=!!(user?.id&&trip?.created_by===user.id);
   const visible=isHost&&!readOnly;
   if(!visible)return {showButton:false,showPanel:false,state:'hidden',rows:[]};
   if(!editPermissionsReady)return {showButton:true,showPanel:true,state:'migration',rows:[]};
   const rows=members.filter(m=>!m.is_guest&&m.user_id!==trip.created_by).map(m=>({
     userId:m.user_id,name:m.name,canEdit:!!m.can_edit,
     status:m.can_edit?'Có quyền chỉnh sửa':'Chỉ xem',
     actionLabel:m.can_edit?'Thu hồi quyền':'Cấp quyền sửa',
     allow:!m.can_edit
   }));
   return {showButton:true,showPanel:true,state:rows.length?'list':'empty',rows};
 }
 return {filterExpenses,sharedAccess,memberPermissionView};
});
