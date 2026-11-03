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
 return {filterExpenses};
});
