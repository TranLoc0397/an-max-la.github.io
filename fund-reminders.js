/* Pure reminder calculations. Do not include in calculateTotals(): reminders are
 * commitments, not recorded expenses, cash movements or member contributions. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TripTogetherFundReminders=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 function remaining(item){
  return Math.max(0,Number(item.total_amount||0)-Number(item.paid_amount||0));
 }
 function totals(items,availableFund){
  const outstanding=(items||[]).reduce((sum,item)=>sum+remaining(item),0);
  const available=Number(availableFund||0);
  return {outstanding,afterReservations:available-outstanding,shortfall:Math.max(0,outstanding-available)};
 }
 function validate(item){
  const total=Number(item.total_amount),paid=Number(item.paid_amount);
  if(!String(item.title||'').trim())return 'Vui lòng nhập tên khoản cần dự phòng.';
  if(!Number.isSafeInteger(total)||total<=0)return 'Tổng tiền phải là số nguyên dương.';
  if(!Number.isSafeInteger(paid)||paid<0||paid>total)return 'Tiền đã đặt cọc/đã trả phải từ 0 đến tổng tiền.';
  if(item.due_on&&!/^\d{4}-\d{2}-\d{2}$/.test(String(item.due_on)))return 'Ngày đến hạn không hợp lệ.';
  if(String(item.note||'').length>250)return 'Ghi chú không được vượt quá 250 ký tự.';
  return '';
 }
 return {remaining,totals,validate};
});
