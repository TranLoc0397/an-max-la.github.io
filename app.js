const SUPABASE_URL = "https://kvziothtatxltncgatrr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wdF9hHZTOa8APs3zG4hxNw_ylyfuETK";
const $ = id => document.getElementById(id);
const localizedAlert=message=>window.alert(window.TripTogetherI18n?.t(String(message))||message);
const localizedConfirm=message=>window.confirm(window.TripTogetherI18n?.t(String(message))||message);
const money = n => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n||0));
const dateToday = () => window.TripTogetherFinance.vietnamDate();
let db, user, trip, members=[], expenses=[], contributions=[], debts=[], channel, readOnly=false, canEdit=false, editPermissionsReady=false, sharedCode=null, sharedPasscode=null, viewerTimer=null;
let editRequests=[], editRequestsAvailable=false, editRequestTimer=null;
let fundReminders=[],fundRemindersAvailable=false;
let payments=[],activityEvents=[],memberInviteEmails=[],memberInviteEmailsAvailable=false;
let refreshSequence=0;
let pendingAction=null;
let pendingTripTitleAction=null;
let actionInFlight=false;
const authCallbackParams=new URLSearchParams(location.hash.replace(/^#/,''));
const authSearchParams=new URLSearchParams(location.search);
const authCallback=authSearchParams.has('code')||authCallbackParams.has('access_token')||authCallbackParams.has('error_code');
const authCallbackError=authCallbackParams.get('error_description')||'';

const PASSWORD_EYE='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const PASSWORD_EYE_OFF='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3 21 21"/><path d="M10.7 5.1a11 11 0 0 1 1.3-.1c6.5 0 10 7 10 7a16 16 0 0 1-3.2 4.1"/><path d="M6.3 6.3C3.4 8.2 2 12 2 12s3.5 7 10 7a10.9 10.9 0 0 0 4.1-.8"/><path d="M10 10a3 3 0 0 0 4 4"/></svg>';
function addPasswordVisibilityControls(root=document){
 root.querySelectorAll('input[type="password"]').forEach(input=>{
  if(input.parentElement.classList.contains('password-field'))return;
  const wrapper=document.createElement('span');
  wrapper.className='password-field';
  input.parentNode.insertBefore(wrapper,input);
  wrapper.append(input);
  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.className='password-toggle';
  toggle.setAttribute('aria-label','Hiện mật khẩu');
  toggle.setAttribute('aria-pressed','false');
  toggle.title='Hiện mật khẩu';
  toggle.innerHTML=PASSWORD_EYE;
  toggle.addEventListener('click',()=>{
   const visible=input.type==='password';
   input.type=visible?'text':'password';
   toggle.setAttribute('aria-label',visible?'Ẩn mật khẩu':'Hiện mật khẩu');
   toggle.setAttribute('aria-pressed',String(visible));
   toggle.title=visible?'Ẩn mật khẩu':'Hiện mật khẩu';
   toggle.innerHTML=visible?PASSWORD_EYE_OFF:PASSWORD_EYE;
   input.focus({preventScroll:true});
  });
  wrapper.append(toggle);
 });
}
function ready(){return SUPABASE_URL.startsWith('https://') && !SUPABASE_ANON_KEY.startsWith('PASTE_') && window.supabase}
const CATEGORY_LABELS={Food:'Ăn uống',Transport:'Di chuyển',Accommodation:'Lưu trú',Tickets:'Vé tham quan',Shopping:'Mua sắm',Other:'Khác'};
const categoryLabel=category=>CATEGORY_LABELS[category]||category||'Khác';
function status(s){const el=$('syncStatus');el.textContent=s;el.classList.toggle('sync-loading',s==='Loading…'||s==='Connecting…')}
function pageLoading(show,message='Loading…'){$('pageLoaderText').textContent=message;$('pageLoader').classList.toggle('hidden',!show)}
function emailSendHelp(error){const code=String(error?.code||'').toLowerCase(),message=String(error?.message||'');if(code==='email_address_not_authorized'||message.toLowerCase().includes('email address not authorized'))return 'Supabase hiện chỉ cho gửi email đến thành viên trong tổ chức. Cần cấu hình SMTP riêng trong Supabase → Authentication → SMTP Settings để gửi đến email khác.';if(code==='over_email_send_rate_limit'||message.toLowerCase().includes('email rate limit'))return 'Đã vượt giới hạn gửi email của Supabase. Dịch vụ mặc định chỉ cho gửi tối đa 2 email mỗi giờ; hãy chờ hoặc cấu hình SMTP riêng.';return message||'Không gửi được email. Hãy kiểm tra cấu hình email trong Supabase Auth Logs.'}
function syncEditPermissions(){const own=members.find(m=>m.user_id===user?.id||m.account_user_id===user?.id);editPermissionsReady=members.length>0&&members.every(m=>typeof m.can_edit==='boolean');canEdit=!!user&&!readOnly&&(trip?.created_by===user.id||!!own&&own.can_edit===true)}
async function toggleMemberEdit(button){if(trip?.created_by!==user?.id)return;const member=members.find(m=>m.user_id===button.dataset.userId);if(!member)return;const allow=button.dataset.allow==='true';const prompt=allow?`Cấp quyền sửa cho ${member.name}? Người này có thể thêm, sửa và xóa khoản chi, đóng quỹ, khoản nợ và thành viên thủ công.`:`Thu hồi quyền sửa của ${member.name}? Thành viên vẫn xem được chuyến đi.`;if(!localizedConfirm(prompt))return;await withButtonLoading(button,allow?'Đang cấp quyền…':'Đang thu hồi…',async()=>{try{const {error}=await db.rpc('set_trip_member_edit_access',{p_trip_id:trip.id,p_member_user_id:member.user_id,p_can_edit:allow});if(error)throw error;await refresh()}catch(error){localizedAlert('Không thể cập nhật quyền sửa: '+error.message+' Nếu chưa cài tính năng này, hãy chạy member_edit_permissions.sql trong Supabase SQL Editor.')}})}
async function fetchEditRequests(tripId){
 if(!tripId)return {items:[],available:false};
 const {data,error}=await db.rpc('list_trip_edit_requests',{p_trip_id:tripId});
 if(error){console.warn('Edit requests unavailable; run trip_edit_requests.sql in Supabase.',error);return {items:[],available:false}}
 return {items:Array.isArray(data)?data:[],available:true};
}

async function requestEditAccess(){
 if(!trip||readOnly||canEdit)return;
 await withButtonLoading($('requestEditBtn'),'Đang gửi yêu cầu…',async()=>{
  const {error}=await db.rpc('request_trip_edit_access',{p_trip_id:trip.id});
  if(error){localizedAlert('Không thể gửi yêu cầu: '+error.message+'. Hãy kiểm tra trip_edit_requests.sql đã được chạy trên Supabase.');return}
  await refresh();localizedAlert('Đã gửi yêu cầu. Host sẽ quyết định cấp quyền chỉnh sửa.');
 });
}
async function reviewEditRequest(button){
 if(!trip||trip.created_by!==user?.id)return;
 const memberId=button.dataset.userId,approve=button.dataset.approve==='true';
 const member=members.find(m=>m.user_id===memberId);
 if(!member||!localizedConfirm((approve?'Cấp quyền chỉnh sửa cho ':'Từ chối yêu cầu của ')+member.name+'?'))return;
 await withButtonLoading(button,'Đang xử lý…',async()=>{
  const {error}=await db.rpc('review_trip_edit_request',{p_trip_id:trip.id,p_member_user_id:memberId,p_approve:approve});
  if(error){localizedAlert('Không thể xử lý yêu cầu: '+error.message);return}
  await refresh();
 });
}
$('requestEditBtn').onclick=requestEditAccess;
async function withButtonLoading(button,message,action){if(!button||actionInFlight)return;actionInFlight=true;const controls=[...document.querySelectorAll('button')],disabled=controls.map(b=>b.disabled),label=button.textContent;controls.forEach(b=>b.disabled=true);button.classList.add('is-loading');button.setAttribute('aria-busy','true');button.textContent=message;try{return await action()}finally{controls.forEach((b,i)=>{if(b.isConnected)b.disabled=disabled[i]});button.classList.remove('is-loading');button.removeAttribute('aria-busy');button.textContent=label;actionInFlight=false}}
// Close member action menus on outside click or Escape; native <details> handles keyboard opening.
document.addEventListener('pointerdown',event=>{
 if(event.target.closest('.member-actions-menu'))return;
 document.querySelectorAll('.member-actions-menu[open]').forEach(menu=>{menu.open=false});
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 const menus=[...document.querySelectorAll('.member-actions-menu[open]')];
 if(!menus.length)return;
 menus.forEach(menu=>{menu.open=false});
 if(!document.querySelector('dialog[open]'))menus[0].querySelector('summary')?.focus();
});
async function init(){
 addPasswordVisibilityControls();
 pageLoading(true,'Connecting to your trip…');
 try{
  const sdkLoaded=await window.__supabaseSdkReady;
  if(sdkLoaded===false){$('setupNotice').classList.remove('hidden');$('setupNotice').textContent='Không tải được thư viện kết nối Supabase từ CDN. Kiểm tra Internet hoặc content blocker rồi tải lại trang.';return}
  if(!ready()){$('setupNotice').classList.remove('hidden');$('setupNotice').textContent='Chưa kết nối cloud. Mở SETUP.md để cấu hình Supabase trước khi dùng chung.';return}
  $('setupNotice').classList.add('hidden');db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  const {data,error}=await db.auth.getSession();if(error)console.error(error);
  if(!data.session){const x=await db.auth.signInAnonymously();if(x.error){localizedAlert('Không thể kết nối: '+x.error.message);return}}
  user=(await db.auth.getUser()).data.user;
  updateAccountButton();
  updateCreateTripAccess();
  await loadMyTrips();
  const code=new URLSearchParams(location.search).get('trip');
  if(code)await openSharedTrip(code)
  if(localStorage.getItem('tt_account_pending')==='true'||(authCallback&&user?.email&&!user.is_anonymous))openAccount(localStorage.getItem('tt_account_pending')==='true'?'register':'login');
  if(authCallbackError){history.replaceState({},'',location.pathname+location.search);localizedAlert(authCallbackError.toLowerCase().includes('expired')?'Link xác minh đã hết hạn. Hãy nhập lại email trong mục Liên kết thiết bị để nhận link mới.':'Không thể xác minh email. Hãy gửi lại email xác minh trong mục Liên kết thiết bị.')}
 }catch(error){console.error(error);localizedAlert('Could not load TripTogether: '+error.message)}
 finally{pageLoading(false)}
}
function canCreateTrip(){return !!user&&!user.is_anonymous}
function updateCreateTripAccess(){
 const button=$('createBtn');
 const hint=$('createLoginHint');
 if(!button)return;
 const signedIn=canCreateTrip();
 button.innerHTML=signedIn?TTIcon('plus')+' Tạo chuyến đi':'Đăng nhập để tạo chuyến đi';
 if(hint)hint.classList.toggle('hidden',signedIn);
 window.TripTogetherI18n?.refresh();
}
function updateAccountButton(){
 const button=$('accountBtn');
 if(!button||!user)return;
 button.textContent=user.is_anonymous||!user.email?'Đăng nhập / Tạo tài khoản':user.email;
}
function accountNotice(message,kind='info'){
 const el=$('accountFeedback');
 if(!el)return;
 el.textContent=message;
 el.className='account-feedback '+(kind==='error'?'account-feedback-error':kind==='success'?'account-feedback-success':'');
 el.classList.remove('hidden');
 el.setAttribute('role',kind==='error'?'alert':'status');
}
function accountError(error){
 const message=String(error?.message||'');
 if(/invalid login credentials/i.test(message))return 'Email hoặc mật khẩu không đúng. Hãy kiểm tra lại hoặc đặt lại mật khẩu.';
 if(/email not confirmed/i.test(message))return 'Email chưa được xác minh. Hãy kiểm tra hộp thư của bạn.';
 if(/user already registered|email already exists|already been registered/i.test(message))return 'Email này đã có tài khoản. Hãy chuyển sang Đăng nhập.';
 return emailSendHelp(error);
}
function accountView(view){
 const content=$('accountContent');
 if(!content)return;
 const anonymous=!!user?.is_anonymous||!user?.email;
 const heading=$('accountDialogTitle');
 if(anonymous){
  heading.textContent='Tài khoản TripTogether';
  content.innerHTML=`<div class="account-intro"><span class="account-intro-icon" aria-hidden="true">${TTIcon('user-circle')}</span><p>Kết nối chuyến đi và quyền chỉnh sửa trên các thiết bị của bạn.</p></div>
   <div class="account-switch" role="group" aria-label="Tài khoản">
    <button type="button" class="account-tab ${view==='login'?'active':''}" data-account-view="login" aria-pressed="${view==='login'}">Đăng nhập</button>
    <button type="button" class="account-tab ${view==='register'?'active':''}" data-account-view="register" aria-pressed="${view==='register'}">Tạo tài khoản</button>
   </div>
   <div id="accountFeedback" class="account-feedback hidden" role="status" aria-live="polite"></div>
   ${view==='register'?`
    <p class="muted account-helper">Đang dùng tài khoản khách? Liên kết email để giữ nguyên các chuyến đi và quyền Host trên thiết bị này. Sau khi xác minh email, bạn sẽ đặt mật khẩu.</p>
    <form id="accountRegisterForm" class="account-form">
      <label>Email<input id="accountRegisterEmail" type="email" autocomplete="email" inputmode="email" required maxlength="254" placeholder="ban@example.com"></label>
      <button class="primary account-submit" id="accountRegisterSave" type="submit">Tiếp tục với email</button>
    </form>`:`
    <form id="accountLoginForm" class="account-form">
      <label>Email<input id="accountLoginEmail" type="email" autocomplete="email" inputmode="email" required maxlength="254" placeholder="ban@example.com"></label>
      <label>Mật khẩu<input id="accountLoginPassword" type="password" autocomplete="current-password" required placeholder="Nhập mật khẩu"></label>
      <div class="account-form-actions"><button class="ghost compact" type="button" id="accountForgotPassword">Quên mật khẩu?</button></div>
      <button class="primary account-submit" type="submit" id="accountLoginSave">Đăng nhập</button>
    </form>
    <p class="muted account-helper">Dùng đúng email đã liên kết với chuyến đi để khôi phục quyền Host hoặc quyền chỉnh sửa.</p>`}
   `;
  content.querySelectorAll('[data-account-view]').forEach(button=>button.onclick=()=>accountView(button.dataset.accountView));
  if(view==='register'){
   $('accountRegisterForm').onsubmit=async event=>{
    event.preventDefault();
    const button=$('accountRegisterSave');
    await withButtonLoading(button,'Đang gửi email…',async()=>{
     try{
      const email=$('accountRegisterEmail').value.trim();
      const {error}=await db.auth.updateUser({email},{emailRedirectTo:location.origin+location.pathname+location.search});
      if(error)throw error;
      localStorage.setItem('tt_account_pending','true');
      accountNotice('Kiểm tra email để xác minh tài khoản. Sau khi xác minh, quay lại đây để tạo mật khẩu.','success');
     }catch(error){accountNotice('Không thể gửi email: '+accountError(error),'error')}
    });
   };
  }else{
   $('accountLoginForm').onsubmit=async event=>{
    event.preventDefault();
    const button=$('accountLoginSave');
    await withButtonLoading(button,'Đang đăng nhập…',async()=>{
     try{
      const {error}=await db.auth.signInWithPassword({email:$('accountLoginEmail').value.trim(),password:$('accountLoginPassword').value});
      if(error)throw error;
      location.reload();
     }catch(error){accountNotice(accountError(error),'error')}
    });
   };
   $('accountForgotPassword').onclick=async()=>{
    const input=$('accountLoginEmail');
    if(!input.value.trim()||!input.checkValidity()){input.reportValidity();input.focus();return}
    const button=$('accountForgotPassword');
    await withButtonLoading(button,'Đang gửi…',async()=>{
     try{
      const {error}=await db.auth.resetPasswordForEmail(input.value.trim(),{redirectTo:location.origin+location.pathname+location.search});
      if(error)throw error;
      accountNotice('Nếu email này có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra hộp thư.','success');
     }catch(error){accountNotice('Không thể gửi liên kết: '+accountError(error),'error')}
    });
   };
  }
  addPasswordVisibilityControls(content);
  return;
 }
 const verified=!!user.email_confirmed_at;
 heading.textContent=verified?'Quản lý tài khoản':'Xác minh email';
 content.innerHTML=`<div class="account-profile"><span class="account-avatar" aria-hidden="true">@</span><div><strong>${esc(user.email||'')}</strong><small>${verified?'Email đã xác minh':'Đang chờ xác minh email'}</small></div></div>
  <div id="accountFeedback" class="account-feedback hidden" role="status" aria-live="polite"></div>
  ${verified?`
   <p class="muted account-helper">Dùng cùng email và mật khẩu trên điện thoại hoặc máy tính để quản lý chuyến đi và quyền Host.</p>
   <form id="accountPasswordForm" class="account-form">
    <label>Mật khẩu mới<input id="accountNewPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Ít nhất 8 ký tự"></label>
    <label>Xác nhận mật khẩu<input id="accountConfirmPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Nhập lại mật khẩu"></label>
    <button class="primary account-submit" type="submit" id="accountPasswordSave">Lưu mật khẩu</button>
   </form>`:`
   <p class="muted account-helper">Mở liên kết xác minh được gửi tới email của bạn, sau đó quay lại TripTogether để tạo mật khẩu.</p>
   <button class="secondary account-submit" type="button" id="accountResend">Gửi lại email xác minh</button>`}
  <div class="account-signout"><button class="danger compact" type="button" id="accountLogout">Đăng xuất khỏi thiết bị</button><p class="muted small">Chỉ đăng xuất thiết bị này, không xóa chuyến đi.</p></div>`;
 if(verified){
  $('accountPasswordForm').onsubmit=async event=>{
   event.preventDefault();
   const password=$('accountNewPassword').value;
   if(password!==$('accountConfirmPassword').value){accountNotice('Mật khẩu xác nhận chưa khớp.','error');return}
   const button=$('accountPasswordSave');
   await withButtonLoading(button,'Đang lưu…',async()=>{
    try{
     const {error}=await db.auth.updateUser({password});
     if(error)throw error;
     localStorage.removeItem('tt_account_pending');
     $('accountPasswordForm').reset();
     accountNotice('Đã lưu mật khẩu. Bạn có thể dùng tài khoản này để đăng nhập trên thiết bị khác.','success');
     // Let the confirmation be read, then close the dialog; the task is done.
     setTimeout(()=>{if($('accountDialog').open)$('accountDialog').close()},1600);
    }catch(error){accountNotice('Không thể lưu mật khẩu: '+accountError(error),'error')}
   });
  };
 }else{
  $('accountResend').onclick=async()=>{
   const button=$('accountResend');
   await withButtonLoading(button,'Đang gửi…',async()=>{
    try{
     const {error}=await db.auth.updateUser({email:user.email},{emailRedirectTo:location.origin+location.pathname+location.search});
     if(error)throw error;
     accountNotice('Email xác minh đã được gửi. Hãy kiểm tra hộp thư.','success');
    }catch(error){accountNotice('Không thể gửi email: '+accountError(error),'error')}
   });
  };
 }
 $('accountLogout').onclick=async()=>{
  if(!localizedConfirm('Đăng xuất khỏi tài khoản trên thiết bị này? Chuyến đi trên thiết bị khác không bị ảnh hưởng.'))return;
  const button=$('accountLogout');
  await withButtonLoading(button,'Đang đăng xuất…',async()=>{
   try{
    const {error}=await db.auth.signOut({scope:'local'});
    if(error)throw error;
    localStorage.removeItem('tt_account_pending');
    location.replace(location.pathname);
   }catch(error){accountNotice('Không thể đăng xuất: '+accountError(error),'error')}
  });
 };
 addPasswordVisibilityControls(content);
}
function openAccount(view){
 if(!db||!user)return;
 accountView(view==='login'||view==='register'?view:'login');
 if(!$('accountDialog').open)$('accountDialog').showModal();
 document.querySelector('#accountContent input')?.focus({preventScroll:true});
}
$('accountBtn').onclick=openAccount;
$('accountClose').onclick=()=>$('accountDialog').close();
async function loadMyTrips(){
 if(!db||!user)return;
 try{
  const {data:memberships,error}=await db.from('members').select('trip_id').eq('user_id',user.id);
  if(error)throw error;
  const tripIds=[...new Set((memberships||[]).map(m=>m.trip_id))];
  // Email-linked memberships are available only after the optional schema migration.
  // A missing account_user_id column must never hide existing Host trips.
  const linked=await db.from('members').select('trip_id').eq('account_user_id',user.id);
  if(!linked.error){
    for(const item of linked.data||[])if(!tripIds.includes(item.trip_id))tripIds.push(item.trip_id);
  }else if(!/account_user_id/i.test(linked.error.message||'')){
    console.warn('Could not check linked member trips',linked.error);
  }
  if(!tripIds.length){
    $('savedTripsSection').classList.remove('hidden');
    $('savedTripList').innerHTML='<button type="button" class="tt-trip-create-tile" id="createTripTile"><span aria-hidden="true">'+TTIcon('plus')+'</span><b>Tạo chuyến đi mới</b><small>Bắt đầu hành trình tiếp theo của bạn.</small></button>';
    $('createTripTile').onclick=()=>$('createBtn').click();
    $('noSavedTrips').classList.remove('hidden');return
  }
  const {data:trips,error:tripError}=await db.from('trips').select('id,name,created_at,created_by').in('id',tripIds).order('created_at',{ascending:false});
  if(tripError)throw tripError;
  $('savedTripList').innerHTML=(trips||[]).map((t,i)=>{
   const cover=TTIcon(['map','luggage','plane','compass','mountain'][i%5]);
   const isHost=t.created_by===user.id;
   const created=t.created_at?new Date(t.created_at).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'';
   return `<article class="tt-trip-card">
     <div class="tt-trip-cover" aria-hidden="true"><span>${cover}</span></div>
     <div class="tt-trip-card-body">
       <span class="tt-trip-role">${isHost?TTIcon('crown')+' Host':TTIcon('check')+' Thành viên'}</span>
       <h3>${esc(t.name)}</h3>
       <p class="muted small">${created?TTIcon('calendar')+' '+esc(created):'TripTogether'} · ${isHost?'Quản lý chuyến đi':'Chuyến đi đã tham gia'}</p>
       <button class="primary trip-open" type="button" data-trip-id="${esc(t.id)}">Xem chuyến đi ${TTIcon('arrow-right','tt-icon-after')}</button>
     </div>
   </article>`;
 }).join('')+`<button type="button" class="tt-trip-create-tile" id="createTripTile"><span aria-hidden="true">${TTIcon('plus')}</span><b>Tạo chuyến đi mới</b><small>Bắt đầu hành trình tiếp theo của bạn.</small></button>`;
  $('savedTripsSection').classList.remove('hidden');$('noSavedTrips').classList.toggle('hidden',!!trips?.length);
  $('savedTripList').querySelectorAll('.trip-open').forEach(button=>button.onclick=()=>withButtonLoading(button,'Opening…',()=>joinTrip(button.dataset.tripId,false)));
  $('createTripTile')?.addEventListener('click',()=>$('createBtn')?.click());
 }catch(error){console.error('Could not load saved trips',error);$('savedTripsSection').classList.remove('hidden');$('savedTripList').innerHTML='';$('noSavedTrips').textContent='Could not load your saved trips. Paste the trip invitation link or code below to open one.';$('noSavedTrips').classList.remove('hidden')}
}
function askName(action){pendingAction=action;$('profileDialog').showModal();$('displayName').focus()}
$('profileForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='profileSave')return;ev.preventDefault();const name=$('displayName').value.trim();if(!name)return;localStorage.setItem('tt_name',name);$('profileDialog').close();await pendingAction(name);pendingAction=null});
function askTripTitle(action){pendingTripTitleAction=action;$('tripTitle').value='';$('tripInitialFund').value='0';$('tripTitleDialog').showModal();$('tripTitle').focus()}
$('profileCancel').onclick=()=>{pendingAction=null;$('profileDialog').close();$('profileForm').reset()};
$('tripTitleCancel').onclick=()=>{$('tripTitleDialog').close()};
$('tripTitleForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='tripTitleSave')return;ev.preventDefault();const title=$('tripTitle').value.trim(),initialFund=Number($('tripInitialFund').value||0);if(!title)return;const action=pendingTripTitleAction;pendingTripTitleAction=null;$('tripTitleDialog').close();if(action)await action(title,initialFund)});
$('tripTitleDialog').addEventListener('close',()=>{if(pendingTripTitleAction){const action=pendingTripTitleAction;pendingTripTitleAction=null;action(null)}});
 $('createTripCardButton').onclick=()=>$('createBtn').click();
 $('createBtn').onclick=()=>{if(!ready()){localizedAlert('Hãy cấu hình Supabase theo SETUP.md trước nhé.');return}if(!canCreateTrip()){openAccount('register');accountNotice('Đăng nhập hoặc tạo tài khoản để tạo và quản lý chuyến đi.');return}askName(async name=>askTripTitle(async(title,initialFund)=>{if(title===null)return;await withButtonLoading($('createBtn'),'Đang tạo…',async()=>{try{const inviteCode=crypto.randomUUID();const {error}=await db.from('trips').insert({name:title,created_by:user.id,invite_code:inviteCode,initial_fund:initialFund});if(error){localizedAlert(error.message);return}const {data:tripId,error:memberError}=await db.rpc('join_trip',{p_invite_code:inviteCode,p_name:name,p_passcode:null});if(memberError){localizedAlert(memberError.message);return}await joinTrip(tripId,false)}catch(error){localizedAlert('Không thể tạo chuyến: '+error.message)}})}))};
 $('joinBtn').onclick=()=>{let raw=$('joinCode').value.trim();let code=raw.match(/[?&]trip=([a-f0-9-]+)/i)?.[1]||raw;if(!code)return;if(!ready()){localizedAlert('Hãy cấu hình Supabase theo SETUP.md trước nhé.');return}void withButtonLoading($('joinBtn'),'Opening…',()=>openSharedTrip(code))};
async function openSharedTrip(code){
 pageLoading(true,'Đang mở chuyến đi…');
 try{
  // The unguessable invitation token grants view-only access; no second passcode is needed.
  const result=await db.rpc('get_shared_trip',{p_invite_code:code,p_passcode:null});
  if(result.error){localizedAlert('Không thể mở chuyến đi: '+result.error.message);return}
  const data=result.data;if(!data?.trip){localizedAlert('Không tìm thấy chuyến đi hoặc link không hợp lệ.');return}const access=window.TripTogetherUI.sharedAccess(user,data.trip,data.members||[]);
  // Permissions are tied to the authenticated user ID, never to a matching email string.
  if(access.joined){await joinTrip(data.trip.id,false);return}
  const ledger=await db.rpc('get_shared_trip_payments',{p_invite_code:code});
  if(ledger.error)throw ledger.error;
  ++refreshSequence;readOnly=true;sharedCode=code;sharedPasscode=null;trip=data.trip;members=data.members||[];expenses=data.expenses||[];contributions=data.contributions||[];debts=data.debts||[];payments=ledger.data||[];activityEvents=[];fundReminders=[];fundRemindersAvailable=false;render();await showTrip();if(viewerTimer)clearInterval(viewerTimer);viewerTimer=setInterval(()=>{if(readOnly&&trip)void refresh()},20000)
 }catch(error){localizedAlert('Không thể mở chuyến đi. '+error.message)}finally{pageLoading(false)}
}
// A private invitation link allows viewing, never permission to edit.
// The viewer must first join as a member; only the trip creator can grant can_edit.
// Claim an existing participant; never create a second financial member.
$('claimMemberForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!readOnly||!sharedCode||!user?.email)return;
 const email=$('claimMemberEmail').value.trim().toLowerCase();
 if(email!==user.email.trim().toLowerCase()){localizedAlert('Email phải trùng với tài khoản đang đăng nhập và đã xác minh.');return}
 const code=sharedCode;
 await withButtonLoading($('claimMemberBtn'),'Đang liên kết…',async()=>{
  try{
   const {data:tripId,error}=await db.rpc('claim_existing_trip_member',{p_invite_code:code});
   if(error)throw error;
   await joinTrip(tripId,false);
  }catch(error){localizedAlert('Không thể liên kết thành viên: '+error.message)}
 });
});
$('sharedAccountBtn').onclick=openAccount;
async function showTrip(){
 
 $('welcome').classList.add('hidden');
 $('app').classList.remove('hidden');
 $('shareBtn').classList.toggle('hidden',readOnly);
 $('inviteBtn').classList.toggle('hidden',readOnly);
 $('tripName').textContent=trip.name;
 $('sharedAccessPanel').classList.toggle('hidden',!readOnly);
 if(readOnly){
   const access=window.TripTogetherUI.sharedAccess(user,trip,members);
   $('sharedAccountBtn').classList.toggle('hidden',access.signedIn);
   $('claimMemberForm').classList.toggle('hidden',!access.signedIn);
   $('claimMemberEmail').value=access.signedIn?(user.email||''):'';
   $('sharedAccessDescription').textContent=access.signedIn
    ?'Host phải gắn email đã xác minh của bạn với một thành viên có sẵn. Liên kết sẽ không tạo thêm người hay thay đổi số tiền.'
    :'Link chia sẻ chỉ để xem. Đăng nhập bằng email được Host gắn với một thành viên có sẵn để liên kết tài khoản.';
 }
 status(readOnly?'Chỉ xem':'Đã đồng bộ');
 window.TripTogetherShell?.openTrip();
}
async function joinTrip(id,ask=true){
 ++refreshSequence; // Invalidate all in-flight reads from the previously open view.
 readOnly=false;sharedCode=null;sharedPasscode=null;if(editRequestTimer){clearInterval(editRequestTimer);editRequestTimer=null}if(viewerTimer){clearInterval(viewerTimer);viewerTimer=null}
 if(!user){status('Not connected');return}
 pageLoading(true,'Opening shared trip…');
 try{
  let tripId=id;
  if(ask){
   const name=localStorage.getItem('tt_name')||'Guest';
   const result=await db.rpc('join_trip',{p_invite_code:id,p_name:name,p_passcode:null});
   if(result.error){localizedAlert('Không thể tham gia chuyến đi: '+result.error.message);return}
   tripId=result.data;
  }
  const {data:tdata,error}=await db.from('trips').select('id,invite_code,name,initial_fund,created_by,created_at').eq('id',tripId).single();
  if(error){localizedAlert('Không tìm thấy chuyến đi hoặc link không hợp lệ. '+error.message);return}
  if(channel){await db.removeChannel(channel);channel=null}
  payments=[];activityEvents=[];fundReminders=[];fundRemindersAvailable=false;memberInviteEmails=[];
  trip=tdata;await refresh();await loadMyTrips();await showTrip();
  // Always filter on the database trip ID; id may be an invitation code.
  const watchChanges=()=>{if(trip?.id===tripId&&!readOnly)void refresh()};
  channel=db.channel('trip-'+tripId)
   .on('postgres_changes',{event:'*',schema:'public',table:'expenses',filter:'trip_id=eq.'+tripId},watchChanges)
   .on('postgres_changes',{event:'*',schema:'public',table:'contributions',filter:'trip_id=eq.'+tripId},watchChanges)
   .on('postgres_changes',{event:'*',schema:'public',table:'trip_fund_reminders',filter:'trip_id=eq.'+tripId},watchChanges)
   .on('postgres_changes',{event:'*',schema:'public',table:'members',filter:'trip_id=eq.'+tripId},watchChanges)
   .on('postgres_changes',{event:'*',schema:'public',table:'member_debts',filter:'trip_id=eq.'+tripId},watchChanges)
   .subscribe(state=>{
     if(trip?.id!==tripId||readOnly)return;
     if(state==='SUBSCRIBED'){status('Live sync');void refresh()}
     else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'||state==='CLOSED')status('Sync error');
     else status('Connecting…');
   });
  $('shareBtn').onclick=invite;$('inviteBtn').onclick=invite;
 }catch(error){console.error(error);localizedAlert('Could not open trip: '+error.message)}
 finally{pageLoading(false)}
}
async function refresh(){
 if(!trip)return;
 const tripId=trip.id,viewOnly=readOnly,inviteCode=sharedCode,request=++refreshSequence;
 const current=()=>request===refreshSequence&&trip?.id===tripId&&readOnly===viewOnly&&(!viewOnly||sharedCode===inviteCode);
 status(viewOnly?'Đang cập nhật…':'Loading…');
 try{
  if(viewOnly){
   const [tripReply,ledgerReply]=await Promise.all([
     db.rpc('get_shared_trip',{p_invite_code:inviteCode,p_passcode:sharedPasscode}),
     db.rpc('get_shared_trip_payments',{p_invite_code:inviteCode})
   ]);
   if(!current())return;
   if(tripReply.error||!tripReply.data?.trip||ledgerReply.error){status('Không thể cập nhật');return}
   const data=tripReply.data;
   trip=data.trip;members=data.members||[];expenses=data.expenses||[];contributions=data.contributions||[];debts=data.debts||[];
   payments=ledgerReply.data||[];activityEvents=[];
   render();status('Chỉ xem');return;
  }
  const [a,b,c,d,requests,ledger,history,invites,reminderReply]=await Promise.all([
   db.from('members').select('*').eq('trip_id',tripId).order('created_at').order('user_id'),
   db.from('expenses').select('*').eq('trip_id',tripId).order('spent_on',{ascending:false}),
   db.from('contributions').select('*').eq('trip_id',tripId).order('paid_on',{ascending:false}),
   db.from('member_debts').select('*').eq('trip_id',tripId).order('incurred_on',{ascending:false}),
   fetchEditRequests(tripId),
   db.from('trip_payments').select('*').eq('trip_id',tripId).order('created_at',{ascending:false}),
   db.from('trip_activity').select('*').eq('trip_id',tripId).order('recorded_at',{ascending:false}).limit(40),
   trip.created_by===user?.id?db.rpc('get_trip_member_invite_emails',{p_trip_id:tripId}):Promise.resolve({data:[],error:null}),
    db.from('trip_fund_reminders').select('*').eq('trip_id',tripId).order('created_at',{ascending:false})
  ]);
  if(!current())return; // Never commit an older or different-trip response.
  if(a.error||b.error||c.error||d.error||ledger.error||history.error){
   console.error('Trip refresh failed',{members:a.error,expenses:b.error,contributions:c.error,debts:d.error,payments:ledger.error,activity:history.error});
   if(await handleDeletedTrip(tripId))return;
   status('Sync error');return;
  }
  if(invites.error&&invites.error.code!=='PGRST202')console.warn('Member email invitations unavailable:',invites.error);
  let nextExpenses=b.data||[],nextContributions=c.data||[],nextDebts=d.data||[],nextPayments=ledger.data||[];
  // A joined member without edit rights may see 0 rows under older Supabase RLS.
  // Confirm that an apparently empty trip really is empty before replacing its
  // previously visible shared-link finances with misleading zero balances.
  const joinedMember=(a.data||[]).find(m=>m.user_id===user?.id||m.account_user_id===user?.id);
  const isReadOnlyMember=!!joinedMember&&!joinedMember.can_edit&&trip.created_by!==user?.id;
  let usedSharedFallback=false;
  if(isReadOnlyMember&&nextExpenses.length===0&&nextContributions.length===0&&nextDebts.length===0&&trip.invite_code){
   const [shared,sharedPayments]=await Promise.all([
    db.rpc('get_shared_trip',{p_invite_code:trip.invite_code,p_passcode:null}),
    db.rpc('get_shared_trip_payments',{p_invite_code:trip.invite_code})
   ]);
   if(!current())return;
   if(shared.error||!shared.data?.trip||sharedPayments.error){status('Không thể xác minh số dư chuyến đi');return}
   const data=shared.data;
   if(data.trip.id!==tripId){status('Không thể xác minh chuyến đi');return}
   if((data.expenses||[]).length||(data.contributions||[]).length||(data.debts||[]).length){
    console.warn('Trip member financial SELECT returned no rows; check read-only RLS policies.');
    nextExpenses=data.expenses||[];nextContributions=data.contributions||[];nextDebts=data.debts||[];
    nextPayments=sharedPayments.data||[];
    usedSharedFallback=true;
   }
  }
  if(!current())return;
  members=a.data||[];expenses=nextExpenses;contributions=nextContributions;debts=nextDebts;payments=nextPayments;activityEvents=history.data||[];
  fundRemindersAvailable=!reminderReply.error;fundReminders=reminderReply.data||[];
  if(reminderReply.error)console.warn('Fund reminders require trip_fund_reminders.sql:',reminderReply.error);memberInviteEmails=invites.error?[]:(invites.data||[]);memberInviteEmailsAvailable=!invites.error;
  editRequests=requests.items;editRequestsAvailable=requests.available;
  render();status(usedSharedFallback?'Chỉ xem · dữ liệu chia sẻ':'Synced');
 }catch(error){if(current()){console.error('Trip refresh failed',error);if(await handleDeletedTrip(trip?.id))return;status('Sync error')}}
}

function render(){
 syncEditPermissions();
 const expenseList=$('expenseList')||document.createElement('div');if(!expenseList.id){expenseList.id='expenseList';expenseList.className='list ledger-list';$('expensesTab')?.append(expenseList)}
 const contributionList=$('contributionList')||document.createElement('div');if(!contributionList.id){contributionList.id='contributionList';contributionList.className='list ledger-list';$('fundTab')?.append(contributionList)}
 const enriched=window.TripTogetherFinance.applyPayments(expenses,debts,payments);
 const displayExpenses=enriched.expenses,displayDebts=enriched.debts;
 const {spent,additional,initial,fund,dueToMembers,cashFund,actualFund}=window.TripTogetherFinance.calculateTotals(trip,displayExpenses,contributions);
 const reminderMath=window.TripTogetherFundReminders;
 const remainingReminder=reminderMath.totals(fundReminders,actualFund);
 const reminderPanel=$('fundReminderList'),reminderOverview=$('fundReminderOverview');
 $('addFundReminder').classList.toggle('hidden',readOnly||!canEdit||!fundRemindersAvailable);
 $('fundReminderSetup').classList.toggle('hidden',readOnly||fundRemindersAvailable);
 // Two distinct amounts are easier to read on a phone than an inline sentence.
 // These are planning figures only; never subtract them from the actual fund ledger.
 const reserveSummary=$('fundReminderSummary');
 if(fundRemindersAvailable&&remainingReminder.outstanding){
  reserveSummary.innerHTML=`<div class="fund-reserve-card" aria-label="Cần dự phòng ${money(remainingReminder.outstanding)}">
   <span class="fund-reserve-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="9" cy="6" rx="5" ry="2.5"/><path d="M4 6v4c0 1.4 2.2 2.5 5 2.5 1.1 0 2.1-.2 2.9-.5M4 10v4c0 1.4 2.2 2.5 5 2.5h1"/><ellipse cx="16" cy="14" rx="5" ry="2.5"/><path d="M11 14v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4"/></svg></span>
   <span class="fund-reserve-details"><span class="fund-reserve-label">Cần dự phòng</span><strong class="fund-reserve-value">${money(remainingReminder.outstanding)}</strong></span>
  </div>
  <div class="fund-reserve-card fund-reserve-card-remaining ${remainingReminder.afterReservations<0?'fund-reserve-card-shortfall':''}" aria-label="Quỹ còn lại sau dự phòng ${money(remainingReminder.afterReservations)}">
   <span class="fund-reserve-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 9V6a3 3 0 0 1 3-3h11M14 13h7v5h-7a2.5 2.5 0 0 1 0-5z"/></svg></span>
   <span class="fund-reserve-details"><span class="fund-reserve-label">Sau khi giữ lại</span><strong class="fund-reserve-value">${money(remainingReminder.afterReservations)}</strong></span>
  </div>`;
 }else{
  reserveSummary.textContent=fundRemindersAvailable?'Chưa có khoản thanh toán cần dự phòng.':'';
 }
 const today=dateToday();
 const outstandingReminders=window.TripTogetherUI.sortByDate(fundReminders,'due_on','oldest').filter(x=>reminderMath.remaining(x)>0);
 reminderPanel.innerHTML=fundRemindersAvailable?(fundReminders.length?window.TripTogetherUI.sortByDate(fundReminders,'due_on','oldest').map(item=>{
  const remaining=reminderMath.remaining(item),overdue=!!item.due_on&&item.due_on<today&&remaining>0;
  const state=remaining===0?'Đã đủ khoản cần trả':overdue?'Đã quá hạn':item.due_on?'':'Chưa đặt hạn';
  const due=item.due_on&&remaining>0?`<span>Hạn</span> <span>${esc(item.due_on)}</span>`:'';
  const parts=[state?`<span>${state}</span>`:'',due,`<span>Tổng</span> <span>${money(item.total_amount)}</span>`,`<span>Đã cọc/trả</span> <span>${money(item.paid_amount)}</span>`].filter(Boolean).join(' · ');
  return `<div class="item fund-reminder-row"><div class="fund-reminder-info"><b data-user-content>${esc(item.title)}</b><small>${parts}</small>${item.note?`<small data-user-content>${esc(item.note)}</small>`:''}</div><div class="fund-reminder-right"><div class="fund-reminder-amount"><strong class="${overdue?'fund-reminder-overdue':''}">${money(remaining||item.total_amount)}</strong><small>${remaining?'Cần giữ lại':'Đã trả đủ'}</small></div>${canEdit?`<div class="fund-reminder-actions"><button class="secondary compact edit-fund-reminder" data-id="${esc(item.id)}" type="button">Sửa</button><button class="danger compact delete-fund-reminder" data-id="${esc(item.id)}" type="button">Xóa</button></div>`:''}</div></div>`;
 }).join(''):'<p class="muted small">Chưa có nhắc thanh toán.</p>'):'';
 reminderOverview.classList.toggle('hidden',!fundRemindersAvailable||!outstandingReminders.length);
 if(fundRemindersAvailable&&outstandingReminders.length){
  const upcoming=outstandingReminders[0];
  reminderOverview.innerHTML=`<strong><span>Nhắc dự phòng quỹ</span>: ${money(remainingReminder.outstanding)}</strong><span><span data-user-content>${esc(upcoming.title)}</span> · <span>Còn</span> ${money(reminderMath.remaining(upcoming))}${upcoming.due_on?` · <span>Hạn</span> ${esc(upcoming.due_on)}`:''}</span><button class="secondary compact" type="button" data-shell-view="fund">Xem chi tiết</button>`;
 }
 reminderPanel.querySelectorAll('.edit-fund-reminder').forEach(button=>button.addEventListener('click',()=>openFundReminder(fundReminders.find(x=>x.id===button.dataset.id))));
 reminderPanel.querySelectorAll('.delete-fund-reminder').forEach(button=>button.addEventListener('click',async()=>{
  if(!canEdit||!localizedConfirm('Xóa nhắc thanh toán này?'))return;
  await withButtonLoading(button,'Đang xóa…',async()=>{
   const {error}=await db.from('trip_fund_reminders').delete().eq('id',button.dataset.id).eq('trip_id',trip.id);
   if(error){localizedAlert('Không thể xóa nhắc: '+error.message);return}
   await refresh();
  });
 }));
 $('totalSpent').textContent=money(spent);$('initialFund').textContent=money(initial);$('additionalFund').textContent=money(additional);$('fundTotal').textContent=money(fund);$('fundBalance').textContent=money(cashFund);$('reimbursementDue').textContent=money(dueToMembers);$('actualFundBalance').textContent=money(actualFund);$('actualFundStat').classList.toggle('stat-net-negative',actualFund<0);$('memberCount').textContent=members.length+' thành viên';$('memberCountHero').textContent=members.length+' thành viên';
 const searchInput=$('expenseSearch'),categoryFilter=$('expenseCategoryFilter'),statusFilter=$('expenseStatusFilter');
 const existingCategory=categoryFilter.value;
 const categories=[...new Set(displayExpenses.map(x=>x.category||'Khác'))].sort((a,b)=>a.localeCompare(b,'vi'));
 categoryFilter.innerHTML='<option value="">Tất cả danh mục</option>'+categories.map(category=>`<option value="${esc(category)}">${esc(categoryLabel(category))}</option>`).join('');
 categoryFilter.value=categories.includes(existingCategory)?existingCategory:'';
 const visibleExpenses=window.TripTogetherUI.sortByDate(window.TripTogetherUI.filterExpenses(displayExpenses,{
   query:searchInput.value,category:categoryFilter.value,status:statusFilter.value
 }),'spent_on',$('expenseDateSort').value);
 expenseList.innerHTML=visibleExpenses.length?visibleExpenses.map(x=>{
   const isPersonal=!!x.payer_id,paid=Number(x.paid_amount||0),remaining=Number(x.amount)-paid;
   const refundLabel=!isPersonal?'Trả trực tiếp từ quỹ':remaining===0?'Quỹ đã hoàn trả':paid>0?'Đã hoàn một phần: '+money(paid)+' / '+money(x.amount):'Quỹ còn nợ '+esc(x.payer_name||'thành viên');
   return `<div class="item record-row"><div class="record-main"><div class="record-title" data-user-content>${esc(x.title)}</div><div class="record-meta">${esc(x.spent_on)} · ${esc(categoryLabel(x.category))} · ${isPersonal?'Ứng bởi '+esc(x.payer_name||'thành viên'):'Lấy từ quỹ chung'}</div><div class="record-status ${isPersonal&&remaining>0?(paid>0?'record-status-partial':'record-status-due'):''}">${refundLabel}</div>${x.note?`<div class="record-note" data-user-content>${esc(x.note)}</div>`:''}${x.receipt_path&&(user&&(trip.created_by===user.id||members.some(m=>m.user_id===user.id||m.account_user_id===user.id)))?`<button type="button" class="secondary compact expense-view-receipt" data-receipt-path="${esc(x.receipt_path)}">Xem ảnh hóa đơn</button>`:''}</div><div class="record-meta record-amount">${money(x.amount)}</div>${canEdit?`<div class="record-buttons">${isPersonal&&remaining>0?`<button class="secondary compact record-payment" data-kind="expense" data-id="${esc(x.id)}" data-reverse="false">Ghi hoàn trả</button>`:''}${isPersonal&&paid>0?`<button class="secondary compact record-payment" data-kind="expense" data-id="${esc(x.id)}" data-reverse="true">Hoàn tác thanh toán</button>`:''}<button class="secondary compact edit-expense" data-id="${esc(x.id)}">Sửa</button><button class="danger compact delete-expense" data-id="${esc(x.id)}" data-title="${esc(x.title)}" aria-label="Xóa khoản chi ${esc(x.title)}">Xóa</button></div>`:''}</div>`;
 }).join(''):'<p class="muted ledger-empty">'+(expenses.length?'Không tìm thấy khoản chi phù hợp.':'Chưa có khoản chi. Thêm khoản chi đầu tiên.')+'</p>';
 contributionList.innerHTML=contributions.length?window.TripTogetherUI.sortByDate(contributions,'paid_on',$('fundDateSort').value).map(x=>`<div class="item record-row"><div class="record-main"><div class="record-title"${x.note?' data-user-content':''}>${esc(x.note||'Đóng quỹ')}</div><div class="record-meta">${esc(x.paid_on)} · ${esc(x.payer_name)}</div></div><div class="record-meta record-amount">${money(x.amount)}</div>${canEdit?`<div class="record-buttons"><button class="secondary compact edit-contribution" data-id="${esc(x.id)}">Sửa</button><button class="danger compact delete-contribution" data-id="${esc(x.id)}" data-note="${esc(x.note||'Đóng quỹ')}" aria-label="Xóa khoản đóng quỹ">Xóa</button></div>`:''}</div>`).join(''):'<p class="muted ledger-empty">Chưa có khoản đóng thêm.</p>';
 expenseList.querySelectorAll('.edit-expense').forEach(button=>button.onclick=()=>openExpense(expenses.find(x=>x.id===button.dataset.id)));
 expenseList.querySelectorAll('.expense-view-receipt').forEach(button=>button.onclick=async()=>{
  const current=button.dataset.receiptPath;
  const tab=window.open('about:blank','_blank');
  try{
   const url=await window.TripTogetherReceipts.signedUrl(db,current);
   if(tab)tab.location.replace(url);else window.open(url,'_blank','noopener,noreferrer');
  }catch(error){if(tab)tab.close();localizedAlert(error.message)}
 });
 contributionList.querySelectorAll('.edit-contribution').forEach(button=>button.onclick=()=>openContribution(contributions.find(x=>x.id===button.dataset.id)));
 expenseList.querySelectorAll('.delete-expense').forEach(button=>button.onclick=()=>removeRecord('expenses',button,`Xóa khoản chi “${button.dataset.title}”? Thao tác này không thể hoàn tác.`));
 expenseList.querySelectorAll('.record-payment').forEach(button=>button.onclick=()=>openPaymentDialog(button.dataset.kind,button.dataset.id,button.dataset.reverse==='true'));
 contributionList.querySelectorAll('.delete-contribution').forEach(button=>button.onclick=()=>removeRecord('contributions',button,`Xóa khoản đóng quỹ “${button.dataset.note}”? Thao tác này không thể hoàn tác.`));
 const memberName=id=>members.find(m=>m.user_id===id)?.name||'Thành viên';
 const expenseBalances=window.TripTogetherFinance.calculateMemberBalances(members,displayExpenses,contributions,{spent,initial,actualFund});
 $('memberList').innerHTML=expenseBalances.length?expenseBalances.map(m=>`<div class="item member-row"><span class="item-title"><span class="member-name-line"><span class="member-display-name" title="${esc(m.name)}">${esc(m.name)}</span>${m.id===trip.created_by?'<span class="creator-label" title="Trip creator">Host</span>':''}</span>${trip.created_by===user?.id&&memberInviteEmails.some(x=>x.member_user_id===m.id)?`<small class="member-invite-email">${TTIcon('mail')} ${esc(memberInviteEmails.find(x=>x.member_user_id===m.id)?.email)}</small>`:''}${m.outstanding?`<small class="member-outstanding">Quỹ còn nợ: ${money(m.outstanding)}</small>`:''}</span><span class="member-cell"><small class="member-mobile-label">Đã chi cá nhân</small><span class="member-value">${money(m.paid)}</span></span><span class="member-cell"><small class="member-mobile-label">Đã đóng quỹ</small><span class="member-value">${money(m.contributed)}</span></span><span class="member-cell"><small class="member-mobile-label">Phần chi</small><span class="member-value">${money(m.share)}</span></span>${canEdit?`<div class="member-edit-actions"><details class="member-actions-menu"><summary aria-label="Thao tác thành viên: ${esc(m.name)}" title="Cài đặt thành viên"><svg class="member-menu-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10.3 2.7a1.8 1.8 0 0 1 3.4 0l.35 1.3c.51.17 1 .45 1.45.84l1.28-.44a1.8 1.8 0 0 1 2.36 2.36l-.44 1.28c.39.45.67.94.84 1.45l1.3.35a1.8 1.8 0 0 1 0 3.4l-1.3.35c-.17.51-.45 1-.84 1.45l.44 1.28a1.8 1.8 0 0 1-2.36 2.36l-1.28-.44c-.45.39-.94.67-1.45.84l-.35 1.3a1.8 1.8 0 0 1-3.4 0l-.35-1.3a5.7 5.7 0 0 1-1.45-.84l-1.28.44a1.8 1.8 0 0 1-2.36-2.36l.44-1.28a5.7 5.7 0 0 1-.84-1.45l-1.3-.35a1.8 1.8 0 0 1 0-3.4l1.3-.35c.17-.51.45-1 .84-1.45l-.44-1.28a1.8 1.8 0 0 1 2.36-2.36l1.28.44c.45-.39.94-.67 1.45-.84z" transform="translate(0 0) scale(.94) translate(.77 .77)"/><circle cx="12" cy="12" r="3"/></svg></summary><div class="member-actions-dropdown" role="group" aria-label="Các thao tác của ${esc(m.name)}"><button type="button" class="secondary compact edit-member" data-user-id="${esc(m.id)}">Sửa</button>${trip.created_by===user?.id&&m.is_guest&&!m.account_user_id&&memberInviteEmailsAvailable?`<button type="button" class="secondary compact link-member-email" data-user-id="${esc(m.id)}">${TTIcon('mail')} Liên kết email</button>`:''}${trip.created_by===user?.id&&m.id!==trip.created_by&&m.is_guest&&!m.account_user_id&&!memberInviteEmails.some(invite=>invite.member_user_id===m.id)?`<button type="button" class="secondary compact merge-member" data-user-id="${esc(m.id)}">Hợp nhất</button>`:''}${m.id!==trip.created_by&& (m.is_guest||trip.created_by===user?.id)?`<button type="button" class="danger compact remove-member" data-user-id="${esc(m.id)}">Xóa</button>`:''}</div></details></div>`:''}</div>`).join(''):'<p class="muted ledger-empty">Chưa có thành viên.</p>';
 $('memberList').querySelectorAll('.edit-member').forEach(button=>button.onclick=()=>openMemberEditor(button.dataset.userId));
 $('memberList').querySelectorAll('.link-member-email').forEach(button=>button.onclick=()=>openMemberEditor(button.dataset.userId,true));
 $('memberList').querySelectorAll('.remove-member').forEach(button=>button.onclick=()=>removeMemberSafely(button));
 $('memberList').querySelectorAll('.merge-member').forEach(button=>button.onclick=()=>openMergeMemberDialog(button.dataset.userId));
 // Keep one compact menu open at a time and close it when an action is selected.
 $('memberList').querySelectorAll('.member-actions-menu').forEach(menu=>{
  // Explicitly toggle the native details element for reliable mobile taps.
  menu.querySelector('summary')?.addEventListener('click',event=>{
   event.preventDefault();
   menu.open=!menu.open;
  });
  menu.addEventListener('toggle',()=>{
   // Elevate the entire card: raising only the dropdown cannot escape a
   // neighboring card's settings-button stacking context.
   menu.closest('.member-row')?.classList.toggle('member-menu-open',menu.open);
   if(menu.open)$('memberList').querySelectorAll('.member-actions-menu').forEach(other=>{if(other!==menu)other.open=false});
  });
  menu.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{menu.open=false}));
 });
 // Close open member menus when clicking elsewhere or pressing Escape.
 const requestPanel=$('editRequestPanel'), requestState=$('editRequestState'), requestBtn=$('requestEditBtn');
 const isHost=trip.created_by===user?.id, joined=members.some(m=>m.user_id===user?.id||m.account_user_id===user?.id);
 requestPanel.classList.add('hidden');
 if(!readOnly&&joined&&!isHost&&!canEdit){
  const mine=editRequests.find(r=>r.user_id===user.id);
  requestState.textContent=!editRequestsAvailable?'Host cần cài trip_edit_requests.sql trên Supabase để bật yêu cầu cấp quyền.':mine?.status==='pending'?'Đang chờ Host duyệt yêu cầu.':mine?.status==='rejected'?'Yêu cầu trước đã bị từ chối. Bạn có thể gửi lại.':'Bạn hiện chỉ được xem. Gửi yêu cầu để Host cấp quyền sửa.';
  requestBtn.classList.toggle('hidden',!editRequestsAvailable||mine?.status==='pending');
 }
 const pendingRequests=editRequests.filter(r=>r.status==='pending');
 const hostRequestPanel=$('hostEditRequestsPanel'),hostRequestList=$('hostEditRequestsList');
 hostRequestPanel.classList.add('hidden');
 const permissionView=window.TripTogetherUI.memberPermissionView({trip,user,members,readOnly,editPermissionsReady});
 $('memberAccessBtn').classList.toggle('hidden',!permissionView.showButton);
 if(!readOnly&&isHost){
  hostRequestList.innerHTML=!editRequestsAvailable?'<p class="muted small">Hãy chạy trip_edit_requests.sql trong Supabase để nhận yêu cầu.</p>':pendingRequests.length?pendingRequests.map(r=>`<div class="member-permission-row"><span><b>${esc(r.name)}</b><small class="member-permission-status">Đang xin quyền chỉnh sửa</small></span><div class="section-actions"><button class="primary compact edit-request-review" data-user-id="${esc(r.user_id)}" data-approve="true">Duyệt</button><button class="secondary compact edit-request-review" data-user-id="${esc(r.user_id)}" data-approve="false">Từ chối</button></div></div>`).join(''):'<p class="muted small">Chưa có yêu cầu cấp quyền mới.</p>';
  hostRequestList.querySelectorAll('.edit-request-review').forEach(b=>b.onclick=()=>reviewEditRequest(b));
 }
 const permissionPanel=$('editPermissionsPanel'),permissionList=$('memberPermissionList');
 permissionPanel.classList.toggle('hidden',!permissionView.showPanel);
 if(permissionView.state==='migration')permissionList.innerHTML='<p class="permission-migration-note">Để bật phân quyền riêng cho từng thành viên, hãy chạy member_edit_permissions.sql một lần trong Supabase SQL Editor. Các thành viên hiện tại vẫn giữ quyền sửa cho đến khi migration được cài.</p>';
 else if(permissionView.showPanel){
  permissionList.innerHTML='<p class="muted small">Chỉ thành viên đã liên kết tài khoản email mới hiện ở đây. Host có thể gắn email cho thành viên thủ công trong mục Sửa.</p>'+(permissionView.rows.length?permissionView.rows.map(r=>`<div class="member-permission-row"><span><b>${esc(r.name)}</b><small class="member-permission-status">${r.status}</small></span><button class="${r.canEdit?'secondary':'primary'} compact member-edit-toggle" data-user-id="${esc(r.userId)}" data-allow="${r.allow}">${r.actionLabel}</button></div>`).join(''):'<p class="muted small">Chưa có thành viên nào đã liên kết tài khoản.</p>');
  permissionList.querySelectorAll('.member-edit-toggle').forEach(button=>button.onclick=()=>toggleMemberEdit(button));
 }
 const expenseTransfers=settle(expenseBalances);$('expenseSettlements').innerHTML=expenseTransfers.length?expenseTransfers.map(t=>`<div class="settlement-row"><span>${esc(t.from)} → ${esc(t.to)}</span><b>${money(t.amount)}</b></div>`).join(''):'<p class="muted small">Quỹ đã cân đối theo phần đóng góp.</p>';
 const fundDues=displayExpenses.filter(x=>x.payer_id&&Number(x.amount)-Number(x.paid_amount||0)>0);
 const fundDueTotal=fundDues.reduce((sum,x)=>sum+Number(x.amount)-Number(x.paid_amount||0),0);
 $('fundDueList').innerHTML=fundDues.length?`<div class="settlement-row fund-due-total"><span>Tổng quỹ còn nợ</span><b>${money(fundDueTotal)}</b></div>`+fundDues.map(x=>{
   const paid=Number(x.paid_amount||0),remaining=Number(x.amount)-paid;
   const detail=esc(x.title)+' · '+esc(x.spent_on||'')+(paid>0?' · đã hoàn '+money(paid)+' / '+money(x.amount):'');
   return `<div class="item payment-history-entry fund-due-entry"><div><b>Quỹ → ${esc(x.payer_name||memberName(x.payer_id))}</b><small class="payment-meta">${detail}</small></div><span class="payment-amount fund-due-amount">${money(remaining)}</span>${canEdit?`<button class="secondary compact record-payment" data-kind="expense" data-id="${esc(x.id)}" data-reverse="false">Ghi hoàn trả</button>`:''}</div>`;
 }).join(''):'<p class="muted small">Quỹ không còn nợ thành viên nào.</p>';
 $('fundDueList').querySelectorAll('.record-payment').forEach(button=>button.onclick=()=>openPaymentDialog('expense',button.dataset.id,false));
 $('debtList').innerHTML=displayDebts.length?displayDebts.map(d=>{
   const paid=Number(d.paid_amount||0),remaining=Number(d.amount)-paid;
   const state=remaining===0?'Đã thanh toán':paid>0?'Đã trả một phần: '+money(paid)+' / '+money(d.amount):'Chưa thanh toán';
   return `<div class="item record-row debt-row"><div class="record-main"><div class="record-title">${esc(memberName(d.debtor_id))} → ${esc(memberName(d.creditor_id))}</div><div class="record-meta">${esc(d.incurred_on)}${d.note?' · '+esc(d.note):''}</div><div class="record-status ${remaining>0?(paid>0?'record-status-partial':'record-status-due'):''}">${state}</div></div><div class="record-meta record-amount">${money(d.amount)}</div>${canEdit?`<div class="record-buttons">${remaining>0?`<button class="secondary compact record-payment" data-kind="debt" data-id="${esc(d.id)}" data-reverse="false">Ghi trả nợ</button>`:''}${paid>0?`<button class="secondary compact record-payment" data-kind="debt" data-id="${esc(d.id)}" data-reverse="true">Hoàn tác thanh toán</button>`:''}<button class="danger compact delete-debt" data-id="${esc(d.id)}" aria-label="Xóa khoản nợ">Xóa</button></div>`:''}</div>`;
 }).join(''):'<p class="muted ledger-empty">Chưa ghi khoản nợ nào.</p>';
 $('debtList').querySelectorAll('.record-payment').forEach(button=>button.onclick=()=>openPaymentDialog(button.dataset.kind,button.dataset.id,button.dataset.reverse==='true'));
 $('debtList').querySelectorAll('.delete-debt').forEach(button=>button.onclick=()=>removeRecord('member_debts',button,'Xóa khoản nợ này?'));
 const balances=window.TripTogetherFinance.calculateDebtBalances(members,displayDebts);
 const transfers=settle(balances);$('debtSettlements').innerHTML=transfers.length?transfers.map(t=>`<div class="settlement-row"><span>${esc(t.from)} → ${esc(t.to)}</span><b>${money(t.amount)}</b></div>`).join(''):'<p class="muted small">Không có khoản nợ chưa thanh toán.</p>';
 const opts=members.map(m=>`<option value="${m.user_id}">${esc(m.name)}</option>`).join('');$('expensePayer').innerHTML='<option value="shared_fund">Lấy từ quỹ chung</option>'+opts;$('fundPayer').innerHTML=opts;
 const paymentHistory=$('paymentHistory'),activityPanel=$('activityPanel'),activityList=$('activityList');
 const memberDisplay=id=>members.find(member=>member.user_id===id)?.name||'Thành viên';
 const expenseById=id=>expenses.find(item=>item.id===id);
 const debtById=id=>debts.find(item=>item.id===id);
 paymentHistory.innerHTML=payments.length?payments.slice(0,60).map(p=>{
   const isExpense=!!p.expense_id,source=isExpense?expenseById(p.expense_id):debtById(p.debt_id);
   const title=isExpense?'Quỹ chung hoàn tiền':'Thanh toán nợ riêng';
   const counterparty=isExpense?(source?.payer_name||'Thành viên'):(memberDisplay(source?.debtor_id)+' → '+memberDisplay(source?.creditor_id));
   const subtitle=String(p.paid_on||'')+' · '+counterparty+(p.note?' · '+p.note:'');
   return `<div class="item payment-history-entry"><div><b>${esc(Number(p.amount)<0?'Hoàn tác · '+title:title)}</b><small class="payment-meta">${esc(subtitle)}</small></div><span class="payment-amount ${Number(p.amount)<0?'payment-reversed':''}">${Number(p.amount)<0?'−':'+'}${money(Math.abs(Number(p.amount)))}</span></div>`;
 }).join(''):'<p class="muted small">Chưa có thanh toán nào.</p>';
 activityPanel.classList.toggle('hidden',readOnly);
 if(!readOnly){
  const entityNames={expenses:'Khoản chi',contributions:'Đóng quỹ',member_debts:'Nợ riêng',trip_payments:'Thanh toán',trip_fund_reminders:'Nhắc dự phòng quỹ'};
  const actionNames={INSERT:'Đã thêm',UPDATE:'Đã sửa',DELETE:'Đã xóa'};
  activityList.innerHTML=activityEvents.length?window.TripTogetherUI.sortByDate(activityEvents,'recorded_at',$('activityDateSort').value).map(event=>{
   const d=event.after_data||event.before_data||{},entity=entityNames[event.source_table]||event.source_table;
   const title=d.title||d.note||d.payer_name||entity;
   const exists=event.source_table==='expenses'?expenses.some(x=>x.id===event.record_id):
     event.source_table==='contributions'?contributions.some(x=>x.id===event.record_id):true;
   const canRestore=canEdit&&event.action==='DELETE'&&!exists&&
     (event.source_table==='expenses'||event.source_table==='contributions');
   const actor=event.actor_id?memberDisplay(event.actor_id):'Hệ thống';
   const changes=window.TripTogetherUI.activityChanges(event);
   const displayChange=(key,value)=>{
    if(value===null||value===undefined||value==='')return 'Không có';
    if(key==='receipt_path')return 'Có ảnh đính kèm';
    if(['amount','total_amount','paid_amount'].includes(key))return money(value);
    if(['payer_id','debtor_id','creditor_id'].includes(key))return memberDisplay(value);
    if(['reimbursed','is_settled'].includes(key))return value?'Có':'Không';
    if(['reimbursed_at','settled_at'].includes(key)){
     const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
    }
    if(key==='category')return categoryLabel(value);
    return String(value);
   };
   const changedRows=changes.map(change=>{
    const before=displayChange(change.key,change.before),after=displayChange(change.key,change.after);
    const description=event.action==='UPDATE'
     ?`<span class="audit-old">${esc(before)}</span><span aria-hidden="true"> → </span><span class="audit-new">${esc(after)}</span>`
     :esc(displayChange(change.key,event.action==='DELETE'?change.before:change.after));
    return `<div class="audit-change"><span class="audit-field">${esc(change.label)}</span><span class="audit-values">${description}</span></div>`;
   }).join('');
   const detail=changedRows||'<p class="muted small">Không có trường dữ liệu nào thay đổi.</p>';
   return `<div class="item activity-entry"><div><b>${esc(actionNames[event.action]||event.action)} · ${esc(entity)}</b><small class="activity-meta">${esc(String(title).slice(0,70))} · ${esc(actor)} · ${esc(new Date(event.recorded_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}))}</small><details class="audit-detail"><summary>Chi tiết thay đổi (${changes.length})</summary><div class="audit-changes">${detail}</div></details></div>${canRestore?`<button type="button" class="secondary compact restore-activity" data-id="${esc(event.id)}">Khôi phục</button>`:''}</div>`;
  }).join(''):'<p class="muted small">Chưa có thay đổi nào được ghi nhận.</p>';
  activityList.querySelectorAll('.restore-activity').forEach(button=>button.onclick=()=>restoreActivity(button));
 }
 window.TripTogetherShell?.render({trip,user,canEdit,members,expenses,contributions,actualFund,balances:expenseBalances});
 $('deleteTripBtn').classList.toggle('hidden',readOnly||trip.created_by!==user.id);$('shareBtn').classList.toggle('hidden',readOnly);$('inviteBtn').classList.toggle('hidden',readOnly);$('leaveBtn').classList.toggle('hidden',readOnly);$('addExpense').classList.toggle('hidden',!canEdit);$('exportExcelBtn').classList.toggle('hidden',readOnly||!canEdit);$('addContribution').classList.toggle('hidden',!canEdit);$('editInitialFundBtn').classList.toggle('hidden',!canEdit);$('addMember').classList.toggle('hidden',!canEdit);$('addDebt').classList.toggle('hidden',!canEdit);$('syncStatus').textContent=readOnly?'Chế độ chỉ xem':canEdit?'Đã đồng bộ':'Chỉ xem · chưa được cấp quyền sửa';
}
// Always fetch a fresh, complete database snapshot, not the filtered UI list
// or a potentially stale realtime cache. Paginate past Supabase's row limit.
// Members must keep the app's order (created_at, then user_id): settle() pairs debtors and
// creditors in list order, so a different order gives different transfer suggestions.
async function excelExportRows(table,tripId){
 const items=[];
 const order=table==='members'?['created_at','user_id']:['id'];
 for(let start=0;;start+=500){
  let query=db.from(table).select('*').eq('trip_id',tripId);
  for(const column of order)query=query.order(column,{ascending:true});
  const {data,error}=await query.range(start,start+499);
  if(error)throw new Error('Không thể lấy dữ liệu '+table+': '+error.message);
  if(!data)throw new Error('Không thể đọc dữ liệu '+table);
  items.push(...data);
  if(data.length<500)break;
 }
 return items;
}
$('exportExcelBtn').onclick=async()=>{
 if(!trip||readOnly||!canEdit||!user){
  localizedAlert('Chỉ Host hoặc thành viên có quyền chỉnh sửa mới được xuất bản sao tài chính.');
  return;
 }
 const tripId=trip.id;
 await withButtonLoading($('exportExcelBtn'),'Đang tạo Excel…',async()=>{
  try{
   const {data:freshTrip,error:tripError}=await db.from('trips').select('*').eq('id',tripId).single();
   if(tripError||!freshTrip)throw new Error('Không thể lấy thông tin chuyến đi: '+(tripError?.message||'Không tìm thấy'));
   const [freshMembers,freshExpenses,freshContributions,freshDebts,freshPayments,freshReminders]=await Promise.all([
    excelExportRows('members',tripId),excelExportRows('expenses',tripId),
    excelExportRows('contributions',tripId),excelExportRows('member_debts',tripId),
    excelExportRows('trip_payments',tripId),fundRemindersAvailable?excelExportRows('trip_fund_reminders',tripId):Promise.resolve([])
   ]);
   if(trip?.id!==tripId)throw new Error('Chuyến đi đã thay đổi; vui lòng thử lại.');
   const {view_passcode_hash, ...safeTrip}=freshTrip; // Never back up secret viewing passcodes.
   const file=window.TripTogetherExcelBackup.download({
    trip:safeTrip,members:freshMembers,expenses:freshExpenses,
    contributions:freshContributions,debts:freshDebts,payments:freshPayments,reminders:freshReminders
   });
   localizedAlert('Đã tạo bản sao Excel: '+file+'\nHãy lưu file tại nơi an toàn. Ảnh hóa đơn cần được sao lưu riêng.');
  }catch(error){localizedAlert('Không thể xuất Excel: '+error.message)}
 });
};

let pendingPayment=null;
function openPaymentDialog(kind,referenceId,reverse=false){
 if(!canEdit)return;
 const enriched=window.TripTogetherFinance.applyPayments(expenses,debts,payments);
 const record=(kind==='expense'?enriched.expenses:enriched.debts).find(x=>x.id===referenceId);
 if(!record)return;
 const paid=Number(record.paid_amount||0),remaining=Number(record.amount)-paid;
 const max=reverse?paid:remaining;
 if(max<=0)return;
 pendingPayment={kind,referenceId,reverse,tripId:trip.id};
 $('paymentDialogTitle').textContent=reverse?'Hoàn tác thanh toán':'Ghi thanh toán';
 $('paymentContext').textContent=(kind==='expense'?'Quỹ chung hoàn tiền':'Thanh toán nợ riêng')+' · '+(reverse?'Đã trả: ':'Còn phải trả: ')+money(max);
 $('paymentAmount').max=String(max);$('paymentAmount').value=String(max);
 $('paymentNote').value='';
 $('paymentDialog').showModal();$('paymentAmount').focus();
}
$('paymentCancel').onclick=()=>{$('paymentDialog').close();pendingPayment=null};
$('paymentDialog').addEventListener('close',()=>{pendingPayment=null});
$('paymentForm').addEventListener('submit',async event=>{
 if(event.submitter?.id!=='paymentSave')return;
 event.preventDefault();
 const pending=pendingPayment;if(!pending||!trip||pending.tripId!==trip.id)return;
 const value=Number($('paymentAmount').value);
 if(!Number.isSafeInteger(value)||value<1||value>Number($('paymentAmount').max)){localizedAlert('Số tiền không hợp lệ');return}
 const amount=pending.reverse?-value:value,note=$('paymentNote').value.trim();
 await withButtonLoading($('paymentSave'),'Đang lưu…',async()=>{
  try{
   const {error}=await db.rpc('record_trip_payment',{p_trip_id:pending.tripId,p_kind:pending.kind,p_reference_id:pending.referenceId,p_amount:amount,p_note:note});
   if(error)throw error;
   $('paymentDialog').close();pendingPayment=null;
   await refresh();
  }catch(error){localizedAlert('Không thể ghi thanh toán: '+error.message)}
 });
});
async function restoreActivity(button){
 if(!canEdit||!trip)return;
 if(!localizedConfirm('Khôi phục khoản đã xóa này?'))return;
 const tripId=trip.id;
 await withButtonLoading(button,'Đang khôi phục…',async()=>{
  const {error}=await db.rpc('restore_trip_record',{p_trip_id:tripId,p_activity_id:button.dataset.id});
  if(error){localizedAlert('Không thể khôi phục: '+error.message);return}
  await refresh();localizedAlert('Đã khôi phục dữ liệu.');
 });
}

async function removeRecord(table,button,message){if(!localizedConfirm(message))return;return withButtonLoading(button,'Removing…',async()=>{try{const {error}=await db.from(table).delete().eq('id',button.dataset.id).eq('trip_id',trip.id);if(error){localizedAlert(`Could not remove item: ${error.message}`);return}
 if(table==='expenses'){
  const path=expenses.find(x=>x.id===button.dataset.id)?.receipt_path;
  if(path){try{await window.TripTogetherReceipts.remove(db,path)}catch(cleanupError){console.warn('Receipt delete cleanup failed',cleanupError)}}
 }
 await refresh()}catch(error){localizedAlert(`Could not remove item: ${error.message}`)}})}
function openMemberEditor(memberId=null,focusEmail=false){
 if(!canEdit)return;
 const member=memberId?members.find(m=>m.user_id===memberId):null;
 const isHost=trip?.created_by===user?.id;
 const pendingEmail=member?memberInviteEmails.find(x=>x.member_user_id===member.user_id)?.email||'':'';
 const alreadyLinked=!!member?.account_user_id;
 const canInvite=isHost&&memberInviteEmailsAvailable&&(!member||(member.is_guest&&!alreadyLinked));
 $('memberEditUserId').value=member?.user_id||'';
 $('memberName').value=member?.name||'';
 $('memberDialogTitle').textContent=member?'Sửa thành viên':'Thêm thành viên';
 $('memberDialogHint').textContent=member?'Cập nhật thành viên mà không thay đổi khoản chi và đóng quỹ đã ghi.':'Thành viên được tính vào phần chia đều của chuyến đi.';
 $('memberSave').textContent=member?'Lưu thay đổi':'Thêm thành viên';
 $('memberOpeningFundField').classList.toggle('hidden',!!member);
 $('memberOpeningFund').value='';
 $('memberInviteEmailField').classList.toggle('hidden',!canInvite);
 $('memberInviteEmail').value=pendingEmail;
 const status=$('memberAccountLinkStatus');
 const statusText=$('memberAccountLinkStatusText');
 const statusEmail=$('memberAccountLinkedEmail');
 status.classList.toggle('hidden',!isHost||!member||canInvite);
 statusEmail.classList.add('hidden');
 statusEmail.textContent='';
 if(isHost&&member&&!canInvite){
   if(alreadyLinked){
     statusText.textContent='Đã liên kết tài khoản. Email không thể được gán lại từ màn hình này.';
     if(pendingEmail){statusEmail.textContent=pendingEmail;statusEmail.classList.remove('hidden')}
   }else if(!memberInviteEmailsAvailable){
     statusText.textContent='Chức năng liên kết email chưa khả dụng. Kiểm tra kết nối Supabase và tải lại trang.';
   }else{
     statusText.textContent='Thành viên này đã tham gia bằng một tài khoản riêng. Không thể gán một email khác để tránh tạo liên kết trùng.';
   }
 }
 $('memberDialog').showModal();
 (canInvite&&focusEmail?$('memberInviteEmail'):$('memberName')).focus();
}
function openMergeMemberDialog(sourceId){
 if(readOnly||trip?.created_by!==user?.id)return;
 const source=members.find(m=>m.user_id===sourceId);
 if(!source||source.user_id===trip.created_by)return;
 // Merging a linked account (or a pending email invitation) can break the
 // one-account-per-trip constraint and silently remove access. Only unlinked
 // manual guest records are eligible on either side.
 const unlinkedGuest=m=>m.is_guest&&!m.account_user_id&&
   !memberInviteEmails.some(invite=>invite.member_user_id===m.user_id);
 if(!unlinkedGuest(source)){localizedAlert('Không thể hợp nhất thành viên đã liên kết hoặc được mời qua email.');return}
 const candidates=members.filter(m=>m.user_id!==sourceId&&m.user_id!==trip.created_by&&unlinkedGuest(m));
 if(!candidates.length){localizedAlert('Không có thành viên phù hợp để hợp nhất.');return}
 $('mergeSourceId').value=source.user_id;
 $('mergeSourceName').textContent=source.name;
 $('mergeTargetId').innerHTML='<option value="">Chọn thành viên cần giữ lại</option>'+
  candidates.map(m=>`<option value="${esc(m.user_id)}">${esc(m.name)}</option>`).join('');
 $('mergeMemberAcknowledge').checked=false;
 $('mergeMemberDialog').showModal();
}
$('mergeMemberCancel').onclick=()=>$('mergeMemberDialog').close();
$('mergeMemberForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(readOnly||trip?.created_by!==user?.id||!$('mergeMemberAcknowledge').checked)return;
 const sourceId=$('mergeSourceId').value,targetId=$('mergeTargetId').value;
 const source=members.find(m=>m.user_id===sourceId),target=members.find(m=>m.user_id===targetId);
 if(!source||!target||sourceId===targetId||sourceId===trip.created_by||targetId===trip.created_by)return;
 if(!source.is_guest||source.account_user_id||!target.is_guest||target.account_user_id||
    memberInviteEmails.some(invite=>invite.member_user_id===sourceId||invite.member_user_id===targetId)){
  localizedAlert('Không thể hợp nhất thành viên đã liên kết hoặc được mời qua email.');return;
 }
 if(!localizedConfirm('Hợp nhất “'+source.name+'” vào “'+target.name+'”?\n'+
  'Số thành viên sẽ giảm 1 và phần chia chi phí sẽ được tính lại. Không thể hoàn tác tự động.'))return;
 await withButtonLoading($('mergeMemberSave'),'Đang hợp nhất…',async()=>{
  try{
   const {data,error}=await db.rpc('merge_duplicate_trip_members',{
    p_trip_id:trip.id,p_source_user_id:sourceId,p_target_user_id:targetId
   });
   if(error)throw error;
   $('mergeMemberDialog').close();
   await refresh();
   localizedAlert('Đã hợp nhất thành viên. Chuyển '+Number(data?.expenses_moved||0)+
    ' khoản chi, '+Number(data?.contributions_moved||0)+' khoản đóng quỹ và '+
    Number(data?.debts_moved||0)+' khoản nợ. Phần chia đã được tính lại.');
  }catch(error){
   // PGRST202: the RPC is not installed on this Supabase project yet.
   const missing=error?.code==='PGRST202'||/Could not find the function/i.test(error?.message||'');
   localizedAlert(missing?'Tính năng hợp nhất chưa được cài trên máy chủ. Host cần chạy merge_duplicate_trip_members.sql trong Supabase SQL Editor. Dữ liệu chưa bị thay đổi.':'Không thể hợp nhất thành viên: '+error.message);
  }
 });
});
async function removeMemberSafely(button){
 if(!canEdit||readOnly)return;
 const member=members.find(m=>m.user_id===button.dataset.userId);
 if(!member||member.user_id===trip.created_by)return;
 const connected=expenses.some(x=>x.payer_id===member.user_id)||
   contributions.some(x=>x.payer_id===member.user_id)||
   debts.some(x=>x.debtor_id===member.user_id||x.creditor_id===member.user_id);
 if(connected){localizedAlert('Không thể xóa thành viên có giao dịch. Dữ liệu tài chính cần được giữ nguyên.');return}
 if(!localizedConfirm('Xóa thành viên “'+member.name+'” khỏi chuyến đi? Phần chi sẽ được chia lại cho các thành viên còn lại.'))return;
 await withButtonLoading(button,'Đang xóa…',async()=>{
  const {error}=await db.rpc('remove_trip_member_safe',{p_trip_id:trip.id,p_member_user_id:member.user_id});
  if(error){localizedAlert('Không thể xóa thành viên: '+error.message);return}
  await refresh();
 });
}

let expenseReceiptFile=null,expenseReceiptObjectUrl=null;
function resetExpenseReceiptPicker(record=null){
 expenseReceiptFile=null;
 if(expenseReceiptObjectUrl){URL.revokeObjectURL(expenseReceiptObjectUrl);expenseReceiptObjectUrl=null}
 $('expenseReceiptFile').value='';$('expenseReceiptCamera').value='';
 $('expenseReceiptPreview').removeAttribute('src');$('expenseReceiptPreview').classList.add('hidden');
 $('expenseRemoveReceipt').checked=false;
 $('expenseReceiptRemoveRow').classList.toggle('hidden',!record?.receipt_path);
 $('expenseReceiptStatus').textContent=record?.receipt_path?'Đã lưu ảnh hóa đơn. Chọn ảnh mới để thay thế.':'Chưa chọn ảnh.';
}
function selectExpenseReceipt(file){
 const error=window.TripTogetherReceipts.validate(file);
 if(error){localizedAlert(error);return}
 if(expenseReceiptObjectUrl)URL.revokeObjectURL(expenseReceiptObjectUrl);
 expenseReceiptFile=file;
 expenseReceiptObjectUrl=URL.createObjectURL(file);
 $('expenseReceiptPreview').src=expenseReceiptObjectUrl;
 $('expenseReceiptPreview').classList.remove('hidden');
 $('expenseRemoveReceipt').checked=false;
 $('expenseReceiptStatus').textContent=file.name||'Ảnh chụp hóa đơn';
}
$('expensePickReceipt').onclick=()=>$('expenseReceiptFile').click();
$('expenseCaptureReceipt').onclick=()=>$('expenseReceiptCamera').click();
$('expenseReceiptFile').addEventListener('change',event=>{if(event.target.files?.[0])selectExpenseReceipt(event.target.files[0])});
$('expenseReceiptCamera').addEventListener('change',event=>{if(event.target.files?.[0])selectExpenseReceipt(event.target.files[0])});
$('expenseDialog').addEventListener('close',()=>resetExpenseReceiptPicker());

function openExpense(record=null){$('expenseForm').reset();$('expenseId').value=record?.id||'';$('expenseTitle').value=record?.title||'';$('expenseAmount').value=record?.amount||'';$('expenseDate').value=record?.spent_on||dateToday();$('expenseNote').value=record?.note||'';if(record?.category&&!Array.from($('expenseCategory').options).some(o=>o.value===record.category))$('expenseCategory').add(new Option(record.category,record.category));$('expenseCategory').value=record?.category||'Food';if(record?.payer_id)$('expensePayer').value=record.payer_id;$('expenseDialogTitle').textContent=record?'Sửa khoản chi':'Thêm khoản chi';$('expenseSave').textContent=record?'Lưu thay đổi':'Lưu khoản chi';resetExpenseReceiptPicker(record);$('expenseDialog').showModal()}
function openFundReminder(record=null){
 if(!canEdit||!fundRemindersAvailable)return;
 $('fundReminderForm').reset();
 $('fundReminderId').value=record?.id||'';
 $('fundReminderName').value=record?.title||'Thuê phòng';
 $('fundReminderTotal').value=record?.total_amount??2100000;
 $('fundReminderPaid').value=record?.paid_amount??400000;
 $('fundReminderDue').value=record?.due_on||'';
 $('fundReminderNote').value=record?.note||'';
 $('fundReminderDialogTitle').textContent=record?'Sửa khoản cần dự phòng':'Nhắc khoản phải thanh toán';
 updateFundReminderPreview();
 $('fundReminderDialog').showModal();
}
function updateFundReminderPreview(){
 const total=Number($('fundReminderTotal').value||0),paid=Number($('fundReminderPaid').value||0);
 const valid=Number.isSafeInteger(total)&&Number.isSafeInteger(paid)&&total>0&&paid>=0&&paid<=total;
 $('fundReminderPreview').textContent=valid?'Cần giữ lại trong quỹ: '+money(total-paid):'Số tiền đã trả không được vượt quá tổng tiền.';
}
$('addFundReminder').onclick=()=>openFundReminder();
$('fundReminderCancel').onclick=()=>$('fundReminderDialog').close();
['fundReminderTotal','fundReminderPaid'].forEach(id=>$(id).addEventListener('input',updateFundReminderPreview));
$('fundReminderForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!trip||readOnly||!canEdit||!fundRemindersAvailable)return;
 const originalTripId=trip.id;
 const payload={
  title:$('fundReminderName').value.trim(),
  total_amount:Number($('fundReminderTotal').value),
  paid_amount:Number($('fundReminderPaid').value),
  due_on:$('fundReminderDue').value||null,
  note:$('fundReminderNote').value.trim()
 };
 const error=window.TripTogetherFundReminders.validate(payload);
 if(error){localizedAlert(error);return}
 const editId=$('fundReminderId').value;
 await withButtonLoading($('fundReminderSave'),'Đang lưu…',async()=>{
  const response=editId
   ?await db.from('trip_fund_reminders').update({...payload,updated_at:new Date().toISOString()}).eq('id',editId).eq('trip_id',originalTripId)
   :await db.from('trip_fund_reminders').insert({...payload,trip_id:originalTripId,created_by:user.id});
  if(response.error){localizedAlert('Không thể lưu nhắc thanh toán: '+response.error.message);return}
  $('fundReminderDialog').close();
  if(trip?.id===originalTripId)await refresh();
 });
});

function openContribution(record=null){$('fundForm').reset();$('fundId').value=record?.id||'';$('fundAmount').value=record?.amount||'';$('fundDate').value=record?.paid_on||dateToday();$('fundNote').value=record?.note||'';if(record?.payer_id)$('fundPayer').value=record.payer_id;$('fundDialogTitle').textContent=record?'Sửa khoản đóng quỹ':'Ghi đóng quỹ';$('fundSave').textContent=record?'Lưu thay đổi':'Lưu khoản đóng';$('fundDialog').showModal()}
const settle = balances => window.TripTogetherFinance.settle(balances);
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function invite(ev){const button=ev?.currentTarget;if(!button)return;return withButtonLoading(button,'Đang tạo link…',async()=>{const url=location.origin+location.pathname+'?trip='+trip.invite_code;try{await navigator.clipboard.writeText(url);localizedAlert('Đã sao chép link xem (không cần mã). Chỉ chia sẻ với người đáng tin cậy.\n'+url)}catch{localizedAlert('Link xem chuyến đi (không cần mã, hãy giữ kín):\n'+url)}})}
$('expenseSearch').addEventListener('input',()=>{if(trip)render()});
$('expenseCategoryFilter').addEventListener('change',()=>{if(trip)render()});
$('expenseStatusFilter').addEventListener('change',()=>{if(trip)render()});
['expenseDateSort','fundDateSort','activityDateSort'].forEach(id=>$(id).addEventListener('change',()=>{if(trip)render()}));
document.querySelectorAll('.tabs .tab[data-tab]').forEach(button=>button.onclick=()=>{
  const view=button.dataset.tab;
  if(window.TripTogetherShell?.activate){
    window.TripTogetherShell.activate(view,false);
  }else{
    // Fallback for older/cached ui-shell.js.
    $('app').classList.remove('tt-overview-mode');
    document.querySelectorAll('.tabs .tab[data-tab]').forEach(tab=>{
      const selected=tab===button;
      tab.classList.toggle('active',selected);
      tab.setAttribute('aria-selected',String(selected));
    });
    ['expenses','fund','people'].forEach(key=>$(key+'Tab').classList.toggle('hidden',key!==view));
  }
});
$('addExpense').onclick=()=>{if(!members.length)return;openExpense()};
$('expenseCancel').onclick=()=>{$('expenseDialog').close();$('expenseForm').reset()};
$('addMember').onclick=()=>openMemberEditor();
$('memberCancel').onclick=()=>{$('memberDialog').close();$('memberForm').reset()};
$('memberAccessBtn').onclick=()=>{
 if(trip?.created_by!==user?.id||readOnly)return;
 $('memberAccessDialog').showModal();
};
$('memberAccessClose').onclick=()=>$('memberAccessDialog').close();
$('addDebt').onclick=()=>{if(members.length<2){localizedAlert('Cần ít nhất hai thành viên để ghi khoản nợ.');return}$('debtCreditor').innerHTML=members.map(m=>`<option value="${esc(m.user_id)}">${esc(m.name)}</option>`).join('');$('debtDebtor').innerHTML=$('debtCreditor').innerHTML;$('debtAmount').value='';$('debtNote').value='';$('debtDate').value=dateToday();$('debtDialog').showModal()};
$('debtCancel').onclick=()=>{$('debtDialog').close();$('debtForm').reset()};
$('debtForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='debtSave')return;ev.preventDefault();const debtorId=$('debtDebtor').value,creditorId=$('debtCreditor').value;if(debtorId===creditorId){localizedAlert('Người nợ và người nhận nợ phải khác nhau.');return}await withButtonLoading($('debtSave'),'Đang lưu…',async()=>{try{const {error}=await db.from('member_debts').insert({trip_id:trip.id,debtor_id:debtorId,creditor_id:creditorId,amount:Number($('debtAmount').value),note:$('debtNote').value.trim(),incurred_on:$('debtDate').value,created_by:user.id});if(error){localizedAlert('Không thể lưu khoản nợ: '+error.message);return}$('debtDialog').close();$('debtForm').reset();await refresh()}catch(error){localizedAlert('Không thể lưu khoản nợ: '+error.message)}})});
$('memberForm').addEventListener('submit',async ev=>{
 ev.preventDefault();
 if(actionInFlight)return;
 const name=$('memberName').value.trim(),memberId=$('memberEditUserId').value;
 if(!name){localizedAlert('Vui lòng nhập tên thành viên.');return}
 if(!trip||readOnly||!canEdit){localizedAlert('Bạn cần quyền chỉnh sửa của chuyến đi để thêm hoặc sửa thành viên.');return}
 const amountText=$('memberOpeningFund').value.trim();
 const amount=amountText===''?0:Number(amountText);
 if(!memberId&&(!Number.isSafeInteger(amount)||amount<0)){
  localizedAlert('Số tiền đóng quỹ phải là số nguyên không âm (VNĐ).');return;
 }
 const tripId=trip.id;
 await withButtonLoading($('memberSave'),'Đang lưu…',async()=>{
  try{
   const isHost=trip.created_by===user?.id;
   const existing=memberId?members.find(m=>m.user_id===memberId):null;
   const email=isHost&&!$('memberInviteEmailField').classList.contains('hidden')
    ?$('memberInviteEmail').value.trim().toLowerCase():'';
   const {error}=memberId
    ?(isHost&&existing?.is_guest&&!existing?.account_user_id&&memberInviteEmailsAvailable
      ?await db.rpc('update_trip_guest_invitation',{p_trip_id:tripId,p_member_user_id:memberId,p_name:name,p_email:email})
      :await db.rpc('update_trip_member_name',{p_trip_id:tripId,p_member_user_id:memberId,p_name:name}))
    :(isHost&&email
      ?await db.rpc('add_guest_member_with_email_and_fund',{p_trip_id:tripId,p_name:name,p_amount:amount,p_email:email})
      :await db.rpc('add_guest_member_with_fund',{p_trip_id:tripId,p_name:name,p_amount:amount}));
   if(error)throw error;
   $('memberDialog').close();$('memberForm').reset();await refresh();
  }catch(error){localizedAlert('Không thể lưu thành viên: '+error.message)}
 });
});
$('expenseForm').addEventListener('submit',async ev=>{
 if(ev.submitter?.id!=='expenseSave')return;ev.preventDefault();
 const id=$('expensePayer').value,p=members.find(x=>x.user_id===id),editId=$('expenseId').value,existing=expenses.find(x=>x.id===editId),reimbursed=!!p&&!!existing?.reimbursed;
 await withButtonLoading($('expenseSave'),'Đang lưu…',async()=>{try{
  const payload={title:$('expenseTitle').value.trim(),amount:Number($('expenseAmount').value),payer_id:p?.user_id||null,payer_name:p?.name||'Quỹ chung',category:$('expenseCategory').value,spent_on:$('expenseDate').value,note:$('expenseNote').value.trim(),reimbursed,reimbursed_at:reimbursed?existing.reimbursed_at:null};
  const receipt=window.TripTogetherReceipts;
  const newExpenseId=editId||crypto.randomUUID();
  let uploadedPath=null;
  try{
   if(expenseReceiptFile){
    const error=receipt.validate(expenseReceiptFile);
    if(error)throw new Error(error);
    uploadedPath=await receipt.upload(db,trip.id,newExpenseId,expenseReceiptFile);
    payload.receipt_path=uploadedPath;
   }else if(editId&&$('expenseRemoveReceipt').checked){
    payload.receipt_path=null;
   }
   const result=editId?await db.from('expenses').update(payload).eq('id',editId).eq('trip_id',trip.id)
     :await db.from('expenses').insert({...payload,id:newExpenseId,trip_id:trip.id,created_by:user.id});
   if(result.error)throw result.error;
  }catch(error){
   if(uploadedPath){try{await receipt.remove(db,uploadedPath)}catch(cleanupError){console.warn('Receipt cleanup failed',cleanupError)}}
   throw error;
  }
  if(existing?.receipt_path&&(uploadedPath||$('expenseRemoveReceipt').checked)){
   try{await receipt.remove(db,existing.receipt_path)}catch(cleanupError){console.warn('Old receipt cleanup failed',cleanupError)}
  }
  $('expenseDialog').close();$('expenseForm').reset();await refresh()
 }catch(error){localizedAlert('Không thể lưu khoản chi: '+error.message)}})
});
$('addContribution').onclick=()=>openContribution();
$('fundCancel').onclick=()=>{$('fundDialog').close();$('fundForm').reset()};
$('fundForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='fundSave')return;ev.preventDefault();const id=$('fundPayer').value,p=members.find(x=>x.user_id===id);if(!p)return;await withButtonLoading($('fundSave'),'Đang lưu…',async()=>{try{const payload={amount:Number($('fundAmount').value),payer_id:id,payer_name:p.name,note:$('fundNote').value.trim(),paid_on:$('fundDate').value};const editId=$('fundId').value;const result=editId?await db.from('contributions').update(payload).eq('id',editId).eq('trip_id',trip.id):await db.from('contributions').insert({...payload,trip_id:trip.id,created_by:user.id});if(result.error){localizedAlert('Không thể lưu khoản đóng quỹ: '+result.error.message);return}$('fundDialog').close();$('fundForm').reset();await refresh()}catch(error){localizedAlert('Không thể lưu khoản đóng quỹ: '+error.message)}})});
$('editInitialFundBtn').onclick=()=>{$('initialFundInput').value=Number(trip.initial_fund||0);$('initialFundDialog').showModal()};
$('initialFundCancel').onclick=()=>{$('initialFundDialog').close();$('initialFundForm').reset()};
$('initialFundForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='initialFundSave')return;ev.preventDefault();const amount=Number($('initialFundInput').value);await withButtonLoading($('initialFundSave'),'Đang lưu…',async()=>{try{const {error}=await db.from('trips').update({initial_fund:amount}).eq('id',trip.id);if(error){localizedAlert('Không thể lưu quỹ ban đầu: '+error.message);return}trip.initial_fund=amount;$('initialFundDialog').close();await refresh()}catch(error){localizedAlert('Không thể lưu quỹ ban đầu: '+error.message)}})});
$('leaveBtn').onclick=()=>{if(!localizedConfirm('Leave this trip on this device?'))return;return withButtonLoading($('leaveBtn'),'Loading…',closeTripView)};
// A trip deleted on another device (or by its Host) makes every follow-up query fail; say so instead of "Sync error".
async function handleDeletedTrip(tripId){
 if(!tripId||!db)return false;
 const {data,error}=await db.from('trips').select('id').eq('id',tripId).maybeSingle();
 if(error||data)return false;
 if(trip?.id!==tripId)return true;
 localizedAlert('Chuyến đi này đã bị xóa hoặc bạn không còn quyền truy cập.');
 await closeTripView();
 return true;
}
// Returning to the trip list only changes the view; it never leaves the trip
// or removes a user's membership.
async function openTripList(){
 if(!trip)return;
 await closeTripView();
 window.scrollTo({top:0,behavior:'auto'});
}

$('tripListNavSide').addEventListener('click',openTripList);
async function closeTripView(){++refreshSequence;if(channel){await db.removeChannel(channel);channel=null}if(viewerTimer){clearInterval(viewerTimer);viewerTimer=null}if(editRequestTimer){clearInterval(editRequestTimer);editRequestTimer=null}trip=null;window.TripTogetherShell?.closeTrip();history.replaceState({},'',location.pathname);$('app').classList.add('hidden');$('welcome').classList.remove('hidden');$('shareBtn').classList.add('hidden');await loadMyTrips()}
$('deleteTripBtn').onclick=()=>{if(trip.created_by!==user.id)return;if(!localizedConfirm(`Delete “${trip.name}” and permanently remove all its expenses, deposits, and members? This cannot be undone.`))return;return withButtonLoading($('deleteTripBtn'),'Deleting…',async()=>{try{const {error}=await db.rpc('delete_trip',{p_trip_id:trip.id});if(error){localizedAlert(`Could not delete trip: ${error.message}\nIf delete-trip support is not installed yet, run delete_trip.sql in the Supabase SQL Editor.`);return}++refreshSequence;if(channel)await db.removeChannel(channel);channel=null;if(editRequestTimer){clearInterval(editRequestTimer);editRequestTimer=null}if(viewerTimer){clearInterval(viewerTimer);viewerTimer=null}trip=null;window.TripTogetherShell?.closeTrip();history.replaceState({},'',location.pathname);$('app').classList.add('hidden');$('welcome').classList.remove('hidden');$('shareBtn').classList.add('hidden');await loadMyTrips()}catch(error){localizedAlert(`Could not delete trip: ${error.message}`)}})};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&trip)void refresh()});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
init();
