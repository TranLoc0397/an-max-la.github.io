const SUPABASE_URL = "https://kvziothtatxltncgatrr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wdF9hHZTOa8APs3zG4hxNw_ylyfuETK";
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n||0));
const dateToday = () => new Date().toISOString().slice(0,10);
let db, user, trip, members=[], expenses=[], contributions=[], channel, readOnly=false, sharedCode=null, viewerTimer=null;
let pendingAction=null;
let pendingTripTitleAction=null;
let actionInFlight=false;
function ready(){return SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.startsWith('PASTE_') && window.supabase}
function status(s){const el=$('syncStatus');el.textContent='● '+s;el.classList.toggle('sync-loading',s==='Loading…'||s==='Connecting…')}
function pageLoading(show,message='Loading…'){$('pageLoaderText').textContent=message;$('pageLoader').classList.toggle('hidden',!show)}
async function withButtonLoading(button,message,action){if(!button||actionInFlight)return;actionInFlight=true;const controls=[...document.querySelectorAll('button')],disabled=controls.map(b=>b.disabled),label=button.textContent;controls.forEach(b=>b.disabled=true);button.classList.add('is-loading');button.setAttribute('aria-busy','true');button.textContent=message;try{return await action()}finally{controls.forEach((b,i)=>{if(b.isConnected)b.disabled=disabled[i]});button.classList.remove('is-loading');button.removeAttribute('aria-busy');button.textContent=label;actionInFlight=false}}
async function init(){
 pageLoading(true,'Connecting to your trip…');
 try{
  if(!ready()){$('setupNotice').classList.remove('hidden');$('setupNotice').textContent='Chưa kết nối cloud. Mở SETUP.md để cấu hình Supabase trước khi dùng chung.';return}
  $('setupNotice').classList.add('hidden');db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  const {data,error}=await db.auth.getSession();if(error)console.error(error);
  if(!data.session){const x=await db.auth.signInAnonymously();if(x.error){alert('Không thể kết nối: '+x.error.message);return}}
  user=(await db.auth.getUser()).data.user;
  await loadMyTrips();
  const code=new URLSearchParams(location.search).get('trip');
  if(code)await openSharedTrip(code)
 }catch(error){console.error(error);alert('Could not load TripTogether: '+error.message)}
 finally{pageLoading(false)}
}
async function loadMyTrips(){
 if(!db||!user)return;
 try{
  const {data:memberships,error}=await db.from('members').select('trip_id').eq('user_id',user.id);
  if(error)throw error;
  const tripIds=[...new Set((memberships||[]).map(m=>m.trip_id))];
  if(!tripIds.length){$('savedTripsSection').classList.remove('hidden');$('savedTripList').innerHTML='';$('noSavedTrips').classList.remove('hidden');return}
  const {data:trips,error:tripError}=await db.from('trips').select('id,name,created_at').in('id',tripIds).order('created_at',{ascending:false});
  if(tripError)throw tripError;
  $('savedTripList').innerHTML=(trips||[]).map(t=>`<div class="item"><div class="item-title">${esc(t.name)}</div><button class="secondary compact trip-open" data-trip-id="${esc(t.id)}">Mở</button></div>`).join('');
  $('savedTripsSection').classList.remove('hidden');$('noSavedTrips').classList.toggle('hidden',!!trips?.length);
  $('savedTripList').querySelectorAll('.trip-open').forEach(button=>button.onclick=()=>withButtonLoading(button,'Opening…',()=>joinTrip(button.dataset.tripId,false)));
 }catch(error){console.error('Could not load saved trips',error);$('savedTripsSection').classList.remove('hidden');$('savedTripList').innerHTML='';$('noSavedTrips').textContent='Could not load your saved trips. Paste the trip invitation link or code below to open one.';$('noSavedTrips').classList.remove('hidden')}
}
function askName(action){pendingAction=action;$('profileDialog').showModal();$('displayName').focus()}
$('profileForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='profileSave')return;ev.preventDefault();const name=$('displayName').value.trim();if(!name)return;localStorage.setItem('tt_name',name);$('profileDialog').close();await pendingAction(name);pendingAction=null});
function askTripTitle(action){pendingTripTitleAction=action;$('tripTitle').value='';$('tripInitialFund').value='0';$('tripTitleDialog').showModal();$('tripTitle').focus()}
$('tripTitleForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='tripTitleSave')return;ev.preventDefault();const title=$('tripTitle').value.trim(),initialFund=Number($('tripInitialFund').value||0);if(!title)return;const action=pendingTripTitleAction;pendingTripTitleAction=null;$('tripTitleDialog').close();if(action)await action(title,initialFund)});
$('tripTitleDialog').addEventListener('close',()=>{if(pendingTripTitleAction){const action=pendingTripTitleAction;pendingTripTitleAction=null;action(null)}});
 $('createBtn').onclick=()=>{if(!ready()){alert('Hãy cấu hình Supabase theo SETUP.md trước nhé.');return}askName(async name=>askTripTitle(async(title,initialFund)=>{if(title===null)return;await withButtonLoading($('createBtn'),'Đang tạo…',async()=>{try{const inviteCode=crypto.randomUUID();const {error}=await db.from('trips').insert({name:title,created_by:user.id,invite_code:inviteCode,initial_fund:initialFund});if(error){alert(error.message);return}const {data:tripId,error:memberError}=await db.rpc('join_trip',{p_invite_code:inviteCode,p_name:name});if(memberError){alert(memberError.message);return}await joinTrip(tripId,false)}catch(error){alert('Không thể tạo chuyến: '+error.message)}})}))};
 $('joinBtn').onclick=()=>{let raw=$('joinCode').value.trim();let code=raw.match(/[?&]trip=([a-f0-9-]+)/i)?.[1]||raw;if(!code)return;if(!ready()){alert('Hãy cấu hình Supabase theo SETUP.md trước nhé.');return}askName(async name=>withButtonLoading($('joinBtn'),'Opening…',()=>joinTrip(code,true)))};
async function openSharedTrip(code){
 pageLoading(true,'Đang mở chuyến đi…');
 try{const {data,error}=await db.rpc('get_shared_trip',{p_invite_code:code});if(error||!data?.trip){alert('Không thể mở chuyến đi. '+(error?.message||'Link không hợp lệ.'));return}if((data.members||[]).some(m=>m.user_id===user.id)){await joinTrip(data.trip.id,false);return}readOnly=true;sharedCode=code;trip=data.trip;members=data.members||[];expenses=data.expenses||[];contributions=data.contributions||[];render();await showTrip();if(viewerTimer)clearInterval(viewerTimer);viewerTimer=setInterval(refresh,20000)}catch(error){alert('Không thể mở chuyến đi. '+error.message)}finally{pageLoading(false)}
}
async function showTrip(){$('welcome').classList.add('hidden');$('app').classList.remove('hidden');$('shareBtn').classList.add('hidden');$('inviteBtn').classList.toggle('hidden',readOnly);$('tripName').textContent=trip.name;status(readOnly?'Chỉ xem':'Đã đồng bộ')}
async function joinTrip(id,ask=true){
 readOnly=false;sharedCode=null;if(viewerTimer){clearInterval(viewerTimer);viewerTimer=null}
 if(!user){status('Not connected');return}
 pageLoading(true,'Opening shared trip…');
 try{
  let tripId=id;
  if(ask){const name=localStorage.getItem('tt_name')||'Guest';const {data:joined,error:joinError}=await db.rpc('join_trip',{p_invite_code:id,p_name:name});if(joinError){alert('Không thể tham gia chuyến đi. '+joinError.message);return}tripId=joined}
  const {data:tdata,error}=await db.from('trips').select('*').eq('id',tripId).single();
  if(error){alert('Không tìm thấy chuyến đi hoặc link không hợp lệ. '+error.message);return}
  trip=tdata;await refresh();await loadMyTrips();await showTrip();$('shareBtn').classList.remove('hidden');
  if(channel)db.removeChannel(channel);
  channel=db.channel('trip-'+id).on('postgres_changes',{event:'*',schema:'public',table:'expenses',filter:'trip_id=eq.'+id},refresh).on('postgres_changes',{event:'*',schema:'public',table:'contributions',filter:'trip_id=eq.'+id},refresh).on('postgres_changes',{event:'*',schema:'public',table:'members',filter:'trip_id=eq.'+id},refresh).subscribe(s=>status(s==='SUBSCRIBED'?'Live sync':'Connecting…'));
  $('shareBtn').onclick=invite;$('inviteBtn').onclick=invite;
 }catch(error){console.error(error);alert('Could not open trip: '+error.message)}
 finally{pageLoading(false)}
}
async function refresh(){
 if(!trip)return;
 status(readOnly?'Đang cập nhật…':'Loading…');
 if(readOnly){const {data,error}=await db.rpc('get_shared_trip',{p_invite_code:sharedCode});if(error||!data?.trip){status('Không thể cập nhật');return}trip=data.trip;members=data.members||[];expenses=data.expenses||[];contributions=data.contributions||[];render();status('Chỉ xem');return}
 const [a,b,c]=await Promise.all([db.from('members').select('*').eq('trip_id',trip.id).order('created_at'),db.from('expenses').select('*').eq('trip_id',trip.id).order('spent_on',{ascending:false}),db.from('contributions').select('*').eq('trip_id',trip.id).order('paid_on',{ascending:false})]);
 if(a.error||b.error||c.error){status('Sync error');return}
 members=a.data||[];expenses=b.data||[];contributions=c.data||[];
 render();status('Synced');
}
function render(){
 const expenseList=$('expenseList')||document.createElement('div');if(!expenseList.id){expenseList.id='expenseList';expenseList.className='list ledger-list';$('expensesTab')?.append(expenseList)}
 const contributionList=$('contributionList')||document.createElement('div');if(!contributionList.id){contributionList.id='contributionList';contributionList.className='list ledger-list';$('fundTab')?.append(contributionList)}
 const spent=expenses.reduce((x,y)=>x+Number(y.amount),0),additional=contributions.reduce((x,y)=>x+Number(y.amount),0),initial=Number(trip.initial_fund||0),fund=initial+additional;
 $('totalSpent').textContent=money(spent);$('initialFund').textContent=money(initial);$('additionalFund').textContent=money(additional);$('fundTotal').textContent=money(fund);$('fundBalance').textContent=money(fund-spent);$('memberCount').textContent=members.length+' thành viên';$('memberCountHero').textContent=members.length+' thành viên';
 expenseList.innerHTML=expenses.length?expenses.map(x=>`<div class="item record-row"><div class="record-main"><div class="record-title">${esc(x.title)}</div><div class="record-meta">${esc(x.spent_on)} · ${esc(x.category||'Khác')} · ${esc(x.payer_name||'Quỹ chung')}</div>${x.note?`<div class="record-note">${esc(x.note)}</div>`:''}</div><div class="record-meta">${money(x.amount)}</div>${readOnly?'':`<div class="record-buttons"><button class="secondary compact edit-expense" data-id="${esc(x.id)}">Sửa</button><button class="danger compact delete-expense" data-id="${esc(x.id)}" data-title="${esc(x.title)}" aria-label="Xóa khoản chi ${esc(x.title)}">Xóa</button></div>`}</div>`).join(''):'<p class="muted ledger-empty">Chưa có khoản chi. Thêm khoản chi đầu tiên.</p>';
 contributionList.innerHTML=contributions.length?contributions.map(x=>`<div class="item record-row"><div class="record-main"><div class="record-title">${esc(x.note||'Đóng quỹ')}</div><div class="record-meta">${esc(x.paid_on)} · ${esc(x.payer_name)}</div></div><div class="record-meta">${money(x.amount)}</div>${readOnly?'':`<div class="record-buttons"><button class="secondary compact edit-contribution" data-id="${esc(x.id)}">Sửa</button><button class="danger compact delete-contribution" data-id="${esc(x.id)}" data-note="${esc(x.note||'Đóng quỹ')}" aria-label="Xóa khoản đóng quỹ">Xóa</button></div>`}</div>`).join(''):'<p class="muted ledger-empty">Chưa có khoản đóng thêm.</p>';
 expenseList.querySelectorAll('.edit-expense').forEach(button=>button.onclick=()=>openExpense(expenses.find(x=>x.id===button.dataset.id)));
 contributionList.querySelectorAll('.edit-contribution').forEach(button=>button.onclick=()=>openContribution(contributions.find(x=>x.id===button.dataset.id)));
 expenseList.querySelectorAll('.delete-expense').forEach(button=>button.onclick=()=>removeRecord('expenses',button,`Xóa khoản chi “${button.dataset.title}”? Thao tác này không thể hoàn tác.`));
 contributionList.querySelectorAll('.delete-contribution').forEach(button=>button.onclick=()=>removeRecord('contributions',button,`Xóa khoản đóng quỹ “${button.dataset.note}”? Thao tác này không thể hoàn tác.`));
 const share=members.length?spent/members.length:0;
 $('memberList').innerHTML=members.map(m=>{const paid=expenses.filter(x=>x.payer_id===m.user_id).reduce((s,x)=>s+Number(x.amount),0),diff=paid-share,label=m.user_id===user.id?' (bạn)':m.is_guest?' (thêm thủ công)':'';return `<div class="item member-row"><div class="item-title">${esc(m.name)}${label}</div><div class="member-value">${money(paid)}</div><div class="member-value">${money(share)}</div><div class="member-value ${diff>0.5?'member-diff-positive':diff<-.5?'member-diff-negative':''}">${diff>0.5?'+':''}${money(diff)}</div></div>`}).join('');
 const balances=members.map(m=>({id:m.user_id,name:m.name,b:expenses.filter(x=>x.payer_id===m.user_id).reduce((s,x)=>s+Number(x.amount),0)-share}));
 const transfers=settle(balances);$('settlements').innerHTML=transfers.length?transfers.map(t=>`<div class="settlement-row"><span>${esc(t.from)} → ${esc(t.to)}</span><b>${money(t.amount)}</b></div>`).join(''):'<p class="muted small">Mọi người đã cân bằng chi phí.</p>';
 const opts=members.map(m=>`<option value="${m.user_id}">${esc(m.name)}</option>`).join('');$('expensePayer').innerHTML='<option value="shared_fund">Lấy từ quỹ chung</option>'+opts;$('fundPayer').innerHTML=opts;
 $('deleteTripBtn').classList.toggle('hidden',readOnly||trip.created_by!==user.id);$('leaveBtn').classList.toggle('hidden',readOnly);$('addExpense').classList.toggle('hidden',readOnly);$('addContribution').classList.toggle('hidden',readOnly);$('editInitialFundBtn').classList.toggle('hidden',readOnly);$('addMember').classList.toggle('hidden',readOnly);$('syncStatus').textContent=readOnly?'● Chế độ chỉ xem':'● Đã đồng bộ';
}
async function removeRecord(table,button,message){if(!confirm(message))return;return withButtonLoading(button,'Removing…',async()=>{try{const {error}=await db.from(table).delete().eq('id',button.dataset.id).eq('trip_id',trip.id);if(error){alert(`Could not remove item: ${error.message}`);return}await refresh()}catch(error){alert(`Could not remove item: ${error.message}`)}})}
function openExpense(record=null){$('expenseForm').reset();$('expenseId').value=record?.id||'';$('expenseTitle').value=record?.title||'';$('expenseAmount').value=record?.amount||'';$('expenseDate').value=record?.spent_on||dateToday();$('expenseNote').value=record?.note||'';if(record?.category&&!Array.from($('expenseCategory').options).some(o=>o.value===record.category))$('expenseCategory').add(new Option(record.category,record.category));$('expenseCategory').value=record?.category||'Food';if(record?.payer_id)$('expensePayer').value=record.payer_id;$('expenseDialogTitle').textContent=record?'Sửa khoản chi':'Thêm khoản chi';$('expenseSave').textContent=record?'Lưu thay đổi':'Lưu khoản chi';$('expenseDialog').showModal()}
function openContribution(record=null){$('fundForm').reset();$('fundId').value=record?.id||'';$('fundAmount').value=record?.amount||'';$('fundDate').value=record?.paid_on||dateToday();$('fundNote').value=record?.note||'';if(record?.payer_id)$('fundPayer').value=record.payer_id;$('fundDialogTitle').textContent=record?'Sửa khoản đóng quỹ':'Đóng quỹ thêm';$('fundSave').textContent=record?'Lưu thay đổi':'Lưu khoản đóng';$('fundDialog').showModal()}
function settle(bs){let debt=bs.filter(x=>x.b<-.5).map(x=>({...x,b:-x.b})),credit=bs.filter(x=>x.b>.5).map(x=>({...x})),out=[];let i=0,j=0;while(i<debt.length&&j<credit.length){let n=Math.min(debt[i].b,credit[j].b);out.push({from:debt[i].name,to:credit[j].name,amount:Math.round(n)});debt[i].b-=n;credit[j].b-=n;if(debt[i].b<.5)i++;if(credit[j].b<.5)j++}return out}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function invite(ev){const button=ev?.currentTarget;if(!button)return;return withButtonLoading(button,'Đang tạo link…',async()=>{const url=location.origin+location.pathname+'?trip='+trip.invite_code;try{await navigator.clipboard.writeText(url);alert('Đã sao chép link xem chuyến đi.\n'+url)}catch{alert('Link xem chuyến đi:\n'+url)}})}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));['expenses','fund','people'].forEach(k=>$(k+'Tab').classList.toggle('hidden',b.dataset.tab!==k))});
$('addExpense').onclick=()=>{if(!members.length)return;openExpense()};
$('expenseCancel').onclick=()=>{$('expenseDialog').close();$('expenseForm').reset()};
$('addMember').onclick=()=>{$('memberName').value='';$('memberDialog').showModal();$('memberName').focus()};
$('memberCancel').onclick=()=>{$('memberDialog').close();$('memberForm').reset()};
$('memberForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='memberSave')return;ev.preventDefault();const name=$('memberName').value.trim();if(!name)return;await withButtonLoading($('memberSave'),'Saving…',async()=>{try{const {error}=await db.rpc('add_guest_member',{p_trip_id:trip.id,p_name:name});if(error){alert('Could not add member: '+error.message+' If this feature is not installed in Supabase yet, run add_member.sql from the TripTogether folder in SQL Editor.');return}$('memberDialog').close();$('memberForm').reset();await refresh()}catch(error){alert('Could not add member: '+error.message)}})});
$('expenseForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='expenseSave')return;ev.preventDefault();const id=$('expensePayer').value,p=members.find(x=>x.user_id===id);await withButtonLoading($('expenseSave'),'Đang lưu…',async()=>{try{const payload={title:$('expenseTitle').value.trim(),amount:Number($('expenseAmount').value),payer_id:p?.user_id||null,payer_name:p?.name||'Quỹ chung',category:$('expenseCategory').value,spent_on:$('expenseDate').value,note:$('expenseNote').value.trim()};const editId=$('expenseId').value;const result=editId?await db.from('expenses').update(payload).eq('id',editId).eq('trip_id',trip.id):await db.from('expenses').insert({...payload,trip_id:trip.id,created_by:user.id});if(result.error){alert('Không thể lưu khoản chi: '+result.error.message);return}$('expenseDialog').close();$('expenseForm').reset();await refresh()}catch(error){alert('Không thể lưu khoản chi: '+error.message)}})});
$('addContribution').onclick=()=>openContribution();
$('fundCancel').onclick=()=>{$('fundDialog').close();$('fundForm').reset()};
$('fundForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='fundSave')return;ev.preventDefault();const id=$('fundPayer').value,p=members.find(x=>x.user_id===id);if(!p)return;await withButtonLoading($('fundSave'),'Đang lưu…',async()=>{try{const payload={amount:Number($('fundAmount').value),payer_id:id,payer_name:p.name,note:$('fundNote').value.trim(),paid_on:$('fundDate').value};const editId=$('fundId').value;const result=editId?await db.from('contributions').update(payload).eq('id',editId).eq('trip_id',trip.id):await db.from('contributions').insert({...payload,trip_id:trip.id,created_by:user.id});if(result.error){alert('Không thể lưu khoản đóng quỹ: '+result.error.message);return}$('fundDialog').close();$('fundForm').reset();await refresh()}catch(error){alert('Không thể lưu khoản đóng quỹ: '+error.message)}})});
$('editInitialFundBtn').onclick=()=>{$('initialFundInput').value=Number(trip.initial_fund||0);$('initialFundDialog').showModal()};
$('initialFundCancel').onclick=()=>{$('initialFundDialog').close();$('initialFundForm').reset()};
$('initialFundForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='initialFundSave')return;ev.preventDefault();const amount=Number($('initialFundInput').value);await withButtonLoading($('initialFundSave'),'Đang lưu…',async()=>{try{const {error}=await db.from('trips').update({initial_fund:amount}).eq('id',trip.id);if(error){alert('Không thể lưu quỹ ban đầu: '+error.message);return}trip.initial_fund=amount;$('initialFundDialog').close();await refresh()}catch(error){alert('Không thể lưu quỹ ban đầu: '+error.message)}})});
$('leaveBtn').onclick=()=>{if(!confirm('Leave this trip on this device?'))return;return withButtonLoading($('leaveBtn'),'Loading…',async()=>{trip=null;history.replaceState({},'',location.pathname);$('app').classList.add('hidden');$('welcome').classList.remove('hidden');$('shareBtn').classList.add('hidden');await loadMyTrips()})};
$('deleteTripBtn').onclick=()=>{if(trip.created_by!==user.id)return;if(!confirm(`Delete “${trip.name}” and permanently remove all its expenses, deposits, and members? This cannot be undone.`))return;return withButtonLoading($('deleteTripBtn'),'Deleting…',async()=>{try{const {error}=await db.rpc('delete_trip',{p_trip_id:trip.id});if(error){alert(`Could not delete trip: ${error.message}\nIf delete-trip support is not installed yet, run delete_trip.sql in the Supabase SQL Editor.`);return}if(channel)await db.removeChannel(channel);channel=null;trip=null;history.replaceState({},'',location.pathname);$('app').classList.add('hidden');$('welcome').classList.remove('hidden');$('shareBtn').classList.add('hidden');await loadMyTrips()}catch(error){alert(`Could not delete trip: ${error.message}`)}})};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
init();
