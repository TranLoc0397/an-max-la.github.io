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
   const text=!query||[item.title,item.note,item.payer_name,item.category,item.currency]
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

// Sort by event date first, then exact creation timestamp when dates match.
// ISO dates are intentionally compared lexically so there is no timezone shift.
function sortByDate(items,dateField,direction='newest'){
 const sign=direction==='oldest'?1:-1;
 const time=value=>String(value||'');
 return [...items].sort((a,b)=>{
  // Undated items (e.g. a reminder without a due date) go last in both directions,
  // so the most urgent dated item is always first when sorting oldest-first.
  const da=time(a[dateField]),dbv=time(b[dateField]);
  if(!da!==!dbv)return da?-1:1;
  const date=da.localeCompare(dbv);
  if(date)return date*sign;
  const exact=time(a.created_at||a.recorded_at).localeCompare(time(b.created_at||b.recorded_at));
  if(exact)return exact*sign;
  return time(a.id).localeCompare(time(b.id))*sign;
 });
}
const AUDIT_FIELDS={
 expenses:{title:'Hạng mục',amount:'Số tiền',payer_id:'Người ứng tiền',payer_name:'Người thanh toán',spent_on:'Ngày chi',category:'Phân loại',note:'Ghi chú',receipt_path:'Ảnh hóa đơn',currency:'Tiền tệ',original_amount:'Số tiền gốc',fx_rate:'Tỷ giá',split:'Cách chia',reimbursed:'Đã hoàn trả',reimbursed_at:'Thời điểm hoàn trả'},
 contributions:{amount:'Số tiền',payer_id:'Người đóng',paid_on:'Ngày đóng',note:'Ghi chú'},
 member_debts:{amount:'Số tiền',debtor_id:'Người nợ',creditor_id:'Người cho vay',incurred_on:'Ngày ghi nợ',is_settled:'Đã thanh toán',settled_at:'Thời điểm thanh toán',note:'Ghi chú'},
 trip_payments:{amount:'Số tiền',expense_id:'Khoản chi liên quan',debt_id:'Khoản nợ liên quan',paid_on:'Ngày thanh toán',note:'Ghi chú'},
 trip_fund_reminders:{title:'Nội dung dự phòng',total_amount:'Tổng tiền phải trả',paid_amount:'Đã cọc / đã trả',due_on:'Hạn thanh toán',note:'Ghi chú'}
};
function activityChanges(event){
 const before=event.before_data||{},after=event.after_data||{};
 const allowed=AUDIT_FIELDS[event.source_table]||{};
 return Object.entries(allowed).filter(([key])=>{
  const oldValue=before[key]??null,newValue=after[key]??null;
  if(event.action==='UPDATE')return JSON.stringify(oldValue)!==JSON.stringify(newValue);
  return (event.action==='DELETE'?oldValue:newValue)!==null&&(event.action==='DELETE'?oldValue:newValue)!=='';
 }).map(([key,label])=>({key,label,before:before[key]??null,after:after[key]??null}));
}
 return {filterExpenses,sharedAccess,memberPermissionView,sortByDate,activityChanges};
});
