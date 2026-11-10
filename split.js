/* Uneven expense splits. Pure helpers: no DOM, no Supabase.
 * expenses.split = null                         → everyone in the trip shares equally (default)
 * expenses.split = {mode:'equal',  weights:{id:1,…}}      → equally among the chosen members
 * expenses.split = {mode:'shares', weights:{id:2,id:1,…}} → by shares (2:1:…)
 * expenses.split = {mode:'exact',  weights:{id:amount,…}} → exact amounts in the expense's entry
 *   currency (original currency for a foreign expense, otherwise VND); they must add up to the total.
 * Allocation itself lives in finance.js (allocateExpense) so balances and previews always agree.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TripTogetherSplit=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 const MODES=['all','equal','shares','exact'];
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

 /* Build the stored value from the form. `values` maps member id → checkbox (true/false) for
  * 'equal', or a positive number for 'shares'/'exact'. Returns null for "everyone, equally". */
 function build(mode,values){
  if(mode==='all'||!mode)return null;
  const weights={};
  for(const [id,v] of Object.entries(values||{})){
   if(mode==='equal'){if(v)weights[id]=1}
   else if(Number(v)>0)weights[id]=Number(v);
  }
  return {mode,weights};
 }

 // `entryTotal` is what the user typed the expense in: original amount when foreign, else VND.
 function validate(split,{entryTotal,members=[]}={}){
  if(split===null||split===undefined)return '';
  if(typeof split!=='object'||!MODES.includes(split.mode)||split.mode==='all')return 'Cách chia không hợp lệ.';
  const entries=Object.entries(split.weights||{});
  if(!entries.length)return split.mode==='equal'?'Chọn ít nhất một người cùng chia khoản này.':'Nhập phần chia cho ít nhất một người.';
  const ids=new Set(members.map(m=>m.user_id));
  for(const [id,w] of entries){
   if(!UUID.test(id)||(ids.size&&!ids.has(id)))return 'Có người trong cách chia không còn là thành viên của chuyến.';
   if(!Number.isFinite(Number(w))||Number(w)<=0)return 'Phần chia phải lớn hơn 0.';
  }
  if(split.mode==='exact'){
   const sum=entries.reduce((s,[,w])=>s+Number(w),0),total=Number(entryTotal);
   if(!Number.isFinite(total)||total<=0)return 'Nhập số tiền khoản chi trước khi chia theo số tiền.';
   const diff=Math.round((total-sum)*100)/100;
   if(Math.abs(diff)>0.01)return diff>0?'Còn '+fmt(diff)+' chưa chia cho ai.':'Đã chia vượt '+fmt(-diff)+' so với tổng tiền.';
  }
  return '';
 }

 // Remaining amount to assign in 'exact' mode (positive = still to assign).
 function remaining(split,entryTotal){
  if(!split||split.mode!=='exact')return 0;
  const sum=Object.values(split.weights||{}).reduce((s,w)=>s+Number(w),0);
  return Math.round((Number(entryTotal)-sum)*100)/100;
 }

 const fmt=n=>Number(n).toLocaleString('vi-VN',{maximumFractionDigits:2});
 const nameOf=(members,id)=>members.find(m=>m.user_id===id)?.name||'Thành viên đã rời';

 /* Short, human summary for the expense list and the audit log. */
 function describe(split,members=[],unit='₫'){
  if(!split||!split.weights)return '';
  const entries=Object.entries(split.weights);
  if(split.mode==='equal'){
   const names=entries.map(([id])=>nameOf(members,id));
   return 'Chia đều cho: '+names.join(', ')+' ('+names.length+'/'+Math.max(members.length,names.length)+')';
  }
  if(split.mode==='shares')return 'Chia theo phần: '+entries.map(([id,w])=>nameOf(members,id)+' '+fmt(w)).join(' · ');
  if(split.mode==='exact')return 'Chia theo số tiền: '+entries.map(([id,w])=>nameOf(members,id)+' '+fmt(w)+' '+unit).join(' · ');
  return '';
 }

 // Is this member part of the split? (null split = everyone)
 function includes(split,memberId){return !split||!split.weights||Object.hasOwn(split.weights,memberId)}

 return {MODES,build,validate,remaining,describe,includes};
});
