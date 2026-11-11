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
   // Store the current view under its own attribute. data-shell-view marks navigation controls, and the
   // global click handler treats any element inside one as a nav click (preventDefault), which would
   // break every form submit inside #app.
   app.dataset.activeView=view;
   app.classList.toggle('tt-overview-mode',view==='overview');
   if(view!=='overview'){
     // Update tab and panel together. Do not dispatch a synthetic click:
     // a tab click also calls activate(), which would leave navigation out of sync.
     document.querySelectorAll('.tabs .tab[data-tab]').forEach(tab=>{
       const selected=tab.dataset.tab===view;
       tab.classList.toggle('active',selected);
       tab.setAttribute('aria-selected',String(selected));
     });
     for(const key of ['expenses','fund','people']){
       pick(key+'Tab')?.classList.toggle('hidden',key!==view);
     }
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
     const symbol=window.TTIcon(({Food:'utensils',Transport:'car',Accommodation:'home',Tickets:'ticket',Shopping:'bag'})[item.category]||'receipt');
     return '<div class="tt-recent-row"><span class="tt-recent-icon" aria-hidden="true">'+symbol+'</span>'+
       '<span class="tt-recent-body"><b data-user-content>'+escapeText(item.title)+'</b><small>'+escapeText(item.payer_name||'Quỹ chung')+' · '+escapeText(window.TripTogetherUI.formatDate(item.spent_on))+'</small></span>'+
       '<strong class="tt-recent-amount">'+fmt(item.amount)+'</strong></div>';
   }).join('');
   pick('ttRecentExpenses').innerHTML=expenseUI||'<p class="tt-overview-empty">Chưa có khoản chi.</p>';
   const balanceById=new Map((data.balances||[]).map(item=>[item.id,item]));
   const initialOf=name=>Array.from(String(name||'?').trim())[0]?.toLocaleUpperCase('vi')||'?';
   const tone=name=>{let h=0;for(const ch of String(name||''))h=(h*31+ch.codePointAt(0))>>>0;return 'tt-tone-'+(h%5)};
   const avatar=(member,cls)=>'<span class="tt-person-avatar '+tone(member.name)+(cls?' '+cls:'')+'" aria-hidden="true">'+escapeText(initialOf(member.name))+'</span>';
   const ordered=[...members].sort((a,b)=>(b.user_id===trip?.created_by)-(a.user_id===trip?.created_by));
   const share=balanceById.size?[...balanceById.values()][0].share:0;
   const allShares=[...balanceById.values()].map(x=>Number(x.share)||0),minShare=allShares.length?Math.min(...allShares):0,maxShare=allShares.length?Math.max(...allShares):0,spread=maxShare-minShare;
   const VISIBLE=4;
   const stack=ordered.slice(0,5).map(member=>avatar(member,'tt-stack-avatar')).join('')+
     (ordered.length>5?'<span class="tt-person-avatar tt-stack-avatar tt-stack-more" aria-hidden="true">+'+(ordered.length-5)+'</span>':'');
   const summary=members.length?'<div class="tt-people-summary"><div class="tt-avatar-stack">'+stack+'</div>'+
     '<div class="tt-people-summary-text"><b>'+members.length+' thành viên</b><small>'+(spread>=1?'Phần chi '+fmt(minShare)+' – '+fmt(maxShare):'Mỗi người đã chi ~'+fmt(share))+'</small></div></div>':'';
   const rows=ordered.slice(0,VISIBLE).map(member=>{
     const info=balanceById.get(member.user_id)||{};
     const isHost=member.user_id===trip?.created_by;
     const owed=Number(info.outstanding||0);
     const sub=owed>0?'<small class="tt-person-flag">'+window.TTIcon('wallet')+' Quỹ nợ '+fmt(owed)+'</small>':'<small>'+(isHost?'Quản lý chuyến đi':'Thành viên')+'</small>';
     return '<div class="tt-person-row">'+avatar(member)+
       '<span class="tt-person-description"><b>'+escapeText(member.name)+(isHost?'<span class="tt-host-chip">Host</span>':'')+'</b>'+sub+'</span>'+
       '<span class="tt-person-stat"><b>'+fmt(info.contributed)+'</b><small>đã đóng</small></span></div>';
   }).join('');
   const more=ordered.length>VISIBLE?'<button type="button" class="tt-people-more" data-shell-view="people">+'+(ordered.length-VISIBLE)+' thành viên khác'+window.TTIcon('arrow-right','tt-icon-after')+'</button>':'';
   pick('ttRecentMembers').innerHTML=members.length?summary+'<div class="tt-people-list">'+rows+'</div>'+more:'<p class="tt-overview-empty">Chưa có thành viên.</p>';
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
