/* TripTogether responsive navigation and live overview.
 * Presentation only: all authentication, membership checks, payments,
 * expense writes and Supabase subscriptions stay in app.js.
 */
(function(){
 'use strict';
 const pick=id=>document.getElementById(id);
 const views=['overview','expenses','fund','people'];
 const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function activate(view,scroll=true){
   if(!views.includes(view)||!pick('app')||pick('app').classList.contains('hidden'))return;
   const app=pick('app');
   app.dataset.shellView=view;
   app.classList.toggle('tt-overview-mode',view==='overview');
   if(view!=='overview'){
     const tab=document.querySelector('.tabs .tab[data-tab="'+view+'"]');
     tab?.click(); // Reuse the existing tab navigation; do not duplicate business logic.
   }
   document.querySelectorAll('[data-shell-view]').forEach(button=>{
     const active=button.dataset.shellView===view;
     button.classList.toggle('active',active);
     if(active)button.setAttribute('aria-current','page');
     else button.removeAttribute('aria-current');
   });
   if(scroll){
     const top=view==='overview'?pick('app'):(pick(view+'Tab')||pick('app'));
     const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
     top?.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});
   }
 }
 function openTrip(){
   document.body.classList.add('tt-trip-open');
   activate('overview',false);
 }
 function closeTrip(){
   document.body.classList.remove('tt-trip-open');
 }
 function render(data){
   if(!data||!pick('ttRecentExpenses'))return;
   const {expenses=[],members=[],trip,canEdit=false,actualFund=0}=data;
   const fmt=n=>Math.round(Number(n)||0).toLocaleString('vi-VN')+' ₫';
   const recent=expenses.slice(0,4);
   const expenseUI=recent.map(item=>{
     const symbol=({Food:'🍜',Transport:'🚗',Accommodation:'🏠',Tickets:'🎟️',Shopping:'🛍️'})[item.category]||'🧾';
     return '<div class="tt-recent-row"><span class="tt-recent-icon" aria-hidden="true">'+symbol+'</span>'+
       '<span class="tt-recent-body"><b>'+escapeText(item.title)+'</b><small>'+escapeText(item.payer_name||'Quỹ chung')+' · '+escapeText(item.spent_on||'')+'</small></span>'+
       '<strong class="tt-recent-amount">'+fmt(item.amount)+'</strong></div>';
   }).join('');
   pick('ttRecentExpenses').innerHTML=expenseUI||'<p class="tt-overview-empty">Chưa có khoản chi.</p>';
   const memberUI=members.slice(0,5).map(member=>{
     const initial=Array.from(String(member.name||'?'))[0]?.toLocaleUpperCase('vi')||'?';
     return '<div class="tt-person-row"><span class="tt-person-avatar" aria-hidden="true">'+escapeText(initial)+'</span>'+
       '<span class="tt-person-description"><b>'+escapeText(member.name)+'</b><small>'+
       (member.user_id===trip?.created_by?'Host':'Thành viên')+'</small></span></div>';
   }).join('');
   pick('ttRecentMembers').innerHTML=memberUI||'<p class="tt-overview-empty">Chưa có thành viên.</p>';
   pick('ttOverviewNetFund').textContent=fmt(actualFund);
   document.querySelectorAll('[data-shell-action="expense"]').forEach(button=>{
     button.disabled=!canEdit;
     button.title=canEdit?'Thêm khoản chi':'Cần quyền chỉnh sửa để thêm khoản chi';
   });
   // No speculative demo numbers. The dashboard displays supplied Supabase records only.
 }
 document.addEventListener('click',event=>{
   const target=event.target.closest('[data-shell-view],[data-shell-action]');
   if(!target)return;
   const view=target.dataset.shellView;
   if(view){event.preventDefault();activate(view);return}
   if(target.dataset.shellAction==='expense'){
     event.preventDefault();
     const add=pick('addExpense');
     if(add&&!add.classList.contains('hidden')&&!add.disabled)add.click();
   }
 });
 window.TripTogetherShell={openTrip,closeTrip,activate,render};
})();
