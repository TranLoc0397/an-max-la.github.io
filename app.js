const SUPABASE_URL = "https://kvziothtatxltncgatrr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wdF9hHZTOa8APs3zG4hxNw_ylyfuETK";
const $ = id => document.getElementById(id);
const localizedAlert=message=>window.alert(window.TripTogetherI18n?.t(String(message))||message);
const localizedConfirm=message=>window.confirm(window.TripTogetherI18n?.t(String(message))||message);
const money = n => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n||0));
const dateToday = () => window.TripTogetherFinance.vietnamDate();
let db, user, trip, members=[], expenses=[], contributions=[], debts=[], channel, readOnly=false, canEdit=false, editPermissionsReady=false, sharedCode=null, sharedPasscode=null, viewerTimer=null;
let editRequests=[], editRequestsAvailable=false, editRequestTimer=null;
let payments=[],activityEvents=[];
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
function status(s){const el=$('syncStatus');el.textContent='● '+s;el.classList.toggle('sync-loading',s==='Loading…'||s==='Connecting…')}
function pageLoading(show,message='Loading…'){$('pageLoaderText').textContent=message;$('pageLoader').classList.toggle('hidden',!show)}
function emailSendHelp(error){const code=String(error?.code||'').toLowerCase(),message=String(error?.message||'');if(code==='email_address_not_authorized'||message.toLowerCase().includes('email address not authorized'))return 'Supabase hiện chỉ cho gửi email đến thành viên trong tổ chức. Cần cấu hình SMTP riêng trong Supabase → Authentication → SMTP Settings để gửi đến email khác.';if(code==='over_email_send_rate_limit'||message.toLowerCase().includes('email rate limit'))return 'Đã vượt giới hạn gửi email của Supabase. Dịch vụ mặc định chỉ cho gửi tối đa 2 email mỗi giờ; hãy chờ hoặc cấu hình SMTP riêng.';return message||'Không gửi được email. Hãy kiểm tra cấu hình email trong Supabase Auth Logs.'}
function syncEditPermissions(){const own=members.find(m=>m.user_id===user?.id);editPermissionsReady=members.length>0&&members.every(m=>typeof m.can_edit==='boolean');canEdit=!!user&&!readOnly&&(trip?.created_by===user.id||!!own&&own.can_edit===true)}
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
 button.textContent=signedIn?'＋ Tạo chuyến đi':'Đăng nhập để tạo chuyến đi';
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
  content.innerHTML=`<div class="account-intro"><span class="account-intro-icon" aria-hidden="true">✳</span><p>Kết nối chuyến đi và quyền chỉnh sửa trên các thiết bị của bạn.</p></div>
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
$('profileCancel').onclick=()=>{pendingAction=null;$('profileDialog').close();$('profileForm').reset()};
$('tripTitleCancel').onclick=()=>{$('tripTitleDialog').close()};
$('tripTitleForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='tripTitleSave')return;ev.preventDefault();const title=$('tripTitle').value.trim(),initialFund=Number($('tripInitialFund').value||0);if(!title)return;const action=pendingTripTitleAction;pendingTripTitleAction=null;$('tripTitleDialog').close();if(action)await action(title,initialFund)});
$('tripTitleDialog').addEventListener('close',()=>{if(pendingTripTitleAction){const action=pendingTripTitleAction;pendingTripTitleAction=null;action(null)}});
 $('createBtn').onclick=()=>{if(!ready()){localizedAlert('Hãy cấu hình Supabase theo SETUP.md trước nhé.');return}if(!canCreateTrip()){openAccount('register');accountNotice('Đăng nhập hoặc tạo tài khoản để tạo và quản lý chuyến đi.');return}askName(async name=>askTripTitle(async(title,initialFund)=>{if(title===null)return;await withButtonLoading($('createBtn'),'Đang tạo…',async()=>{try{const inviteCode=crypto.randomUUID();const {error}=await db.from('trips').insert({name:title,created_by:user.id,invite_code:inviteCode,initial_fund:initialFund});if(error){localizedAlert(error.message);return}const {data:tripId,error:memberError}=await db.rpc('join_trip',{p_invite_code:inviteCode,p_name:name,p_passcode:null});if(memberError){localizedAlert(memberError.message);return}await joinTrip(tripId,false)}catch(error){localizedAlert('Không thể tạo chuyến: '+error.message)}})}))};
 $('joinBtn').onclick=()=>{let raw=$('joinCode').value.trim();let code=raw.match(/[?&]trip=([a-f0-9-]+)/i)?.[1]||raw;if(!code)return;if(!ready()){localizedAlert('Hãy cấu hình Supabase theo SETUP.md trước nhé.');return}askName(async name=>withButtonLoading($('joinBtn'),'Opening…',()=>joinTrip(code,true)))};
async function openSharedTrip(code){
 pageLoading(true,'Đang mở chuyến đi…');
 try{
  // The unguessable invitation token grants view-only access; no second passcode is needed.
  const result=await db.rpc('get_shared_trip',{p_invite_code:code,p_passcode:null});
  if(result.error){localizedAlert('Không thể mở chuyến đi: '+result.error.message);return}
  const data=result.data;if(!data?.trip){localizedAlert('Không tìm thấy chuyến đi hoặc link không hợp lệ.');return}if((data.members||[]).some(m=>m.user_id===user.id)){await joinTrip(data.trip.id,false);return}
  const ledger=await db.rpc('get_shared_trip_payments',{p_invite_code:code});
  if(ledger.error)throw ledger.error;
  ++refreshSequence;readOnly=true;sharedCode=code;sharedPasscode=null;trip=data.trip;members=data.members||[];expenses=data.expenses||[];contributions=data.contributions||[];debts=data.debts||[];payments=ledger.data||[];activityEvents=[];render();await showTrip();if(viewerTimer)clearInterval(viewerTimer);viewerTimer=setInterval(()=>{if(readOnly&&trip)void refresh()},20000)
 }catch(error){localizedAlert('Không thể mở chuyến đi. '+error.message)}finally{pageLoading(false)}
}
// A private invitation link allows viewing, never permission to edit.
// The viewer must first join as a member; only the trip creator can grant can_edit.
async function joinFromSharedView(name){
 if(!readOnly||!sharedCode||!user)return;
 const code=sharedCode;
 await withButtonLoading($('joinSharedTripBtn'),'Đang tham gia…',async()=>{
  try{
   const {data:tripId,error}=await db.rpc('join_trip',{p_invite_code:code,p_name:name,p_passcode:null});
   if(error)throw error;
   await joinTrip(tripId,false);
   if(!readOnly)localizedAlert('Đã tham gia chuyến đi. Mở tab Thành viên → Xin quyền chỉnh sửa để gửi yêu cầu cho Host.');
  }catch(error){localizedAlert('Không thể tham gia chuyến đi: '+error.message)}
 });
}
$('joinSharedTripBtn').onclick=()=>askName(joinFromSharedView);
$('sharedAccountBtn').onclick=openAccount;
async function showTrip(){
 $('welcome').classList.add('hidden');
 $('app').classList.remove('hidden');
 $('shareBtn').classList.toggle('hidden',readOnly);
 $('inviteBtn').classList.toggle('hidden',readOnly);
 $('tripName').textContent=trip.name;
 $('sharedAccessPanel').classList.toggle('hidden',!readOnly);
 status(readOnly?'Chỉ xem':'Đã đồng bộ');
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
  payments=[];activityEvents=[];
  trip=tdata;await refresh();await loadMyTrips();await showTrip();
  // Always filter on the database trip ID; id may be an invitation code.
  const watchChanges=()=>{if(trip?.id===tripId&&!readOnly)void refresh()};
  channel=db.channel('trip-'+tripId)
   .on('postgres_changes',{event:'*',schema:'public',table:'expenses',filter:'trip_id=eq.'+tripId},watchChanges)
   .on('postgres_changes',{event:'*',schema:'public',table:'contributions',filter:'trip_id=eq.'+tripId},watchChanges)
   .on('postgres_changes',{event:'*',schema:'public',table:'members',filter:'trip_id=eq.'+tripId},watchChanges)
   .on('postgres_changes',{event:'*',schema:'public',table:'member_debts',filter:'trip_id=eq.'+tripId},watchChanges)
   .subscribe(state=>{
     if(trip?.id!==tripId||readOnly)return;
     if(state==='SUBSCRIBED'){status('Live sync');void refresh()}
     else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'||state==='CLOSED')status('Sync error');
     else status('Connecting…');
   });
  // Refresh request statuses and pending Host approvals while this trip is open.
  const pollingTripId=trip.id;
  editRequestTimer=setInterval(async()=>{
    if(!trip||readOnly||trip.id!==pollingTripId)return;
    const latest=await fetchEditRequests(pollingTripId);
    if(!trip||readOnly||trip.id!==pollingTripId)return;
    if(latest.available!==editRequestsAvailable||JSON.stringify(latest.items)!==JSON.stringify(editRequests))void refresh();
  },20000);
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
  const [a,b,c,d,requests,ledger,history]=await Promise.all([
   db.from('members').select('*').eq('trip_id',tripId).order('created_at'),
   db.from('expenses').select('*').eq('trip_id',tripId).order('spent_on',{ascending:false}),
   db.from('contributions').select('*').eq('trip_id',tripId).order('paid_on',{ascending:false}),
   db.from('member_debts').select('*').eq('trip_id',tripId).order('incurred_on',{ascending:false}),
   fetchEditRequests(tripId),
   db.from('trip_payments').select('*').eq('trip_id',tripId).order('created_at',{ascending:false}),
   db.from('trip_activity').select('*').eq('trip_id',tripId).order('recorded_at',{ascending:false}).limit(40)
  ]);
  if(!current())return; // Never commit an older or different-trip response.
  if(a.error||b.error||c.error||d.error||ledger.error||history.error){status('Sync error');return}
  members=a.data||[];expenses=b.data||[];contributions=c.data||[];debts=d.data||[];payments=ledger.data||[];activityEvents=history.data||[];
  editRequests=requests.items;editRequestsAvailable=requests.available;
  render();status('Synced');
 }catch(error){if(current()){console.error('Trip refresh failed',error);status('Sync error')}}
}

function render(){
 syncEditPermissions();
 const expenseList=$('expenseList')||document.createElement('div');if(!expenseList.id){expenseList.id='expenseList';expenseList.className='list ledger-list';$('expensesTab')?.append(expenseList)}
 const contributionList=$('contributionList')||document.createElement('div');if(!contributionList.id){contributionList.id='contributionList';contributionList.className='list ledger-list';$('fundTab')?.append(contributionList)}
 const enriched=window.TripTogetherFinance.applyPayments(expenses,debts,payments);
 const displayExpenses=enriched.expenses,displayDebts=enriched.debts;
 const {spent,additional,initial,fund,dueToMembers,cashFund,actualFund}=window.TripTogetherFinance.calculateTotals(trip,displayExpenses,contributions);
 $('totalSpent').textContent=money(spent);$('initialFund').textContent=money(initial);$('additionalFund').textContent=money(additional);$('fundTotal').textContent=money(fund);$('fundBalance').textContent=money(cashFund);$('reimbursementDue').textContent=money(dueToMembers);$('actualFundBalance').textContent=money(actualFund);$('actualFundStat').classList.toggle('stat-net-negative',actualFund<0);$('memberCount').textContent=members.length+' thành viên';$('memberCountHero').textContent=members.length+' thành viên';
 const searchInput=$('expenseSearch'),categoryFilter=$('expenseCategoryFilter'),statusFilter=$('expenseStatusFilter');
 const existingCategory=categoryFilter.value;
 const categories=[...new Set(displayExpenses.map(x=>x.category||'Khác'))].sort((a,b)=>a.localeCompare(b,'vi'));
 categoryFilter.innerHTML='<option value="">Tất cả danh mục</option>'+categories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join('');
 categoryFilter.value=categories.includes(existingCategory)?existingCategory:'';
 const query=searchInput.value.trim().toLocaleLowerCase('vi');
 const visibleExpenses=displayExpenses.filter(x=>{
   const paid=Number(x.paid_amount||0),remaining=Number(x.amount)-paid;
   const matchesText=!query||[x.title,x.note,x.payer_name,x.category].some(v=>String(v||'').toLocaleLowerCase('vi').includes(query));
   const matchesStatus=!statusFilter.value||(statusFilter.value==='due'&&!!x.payer_id&&remaining>0&&paid===0)||
     (statusFilter.value==='partial'&&!!x.payer_id&&remaining>0&&paid>0)||
     (statusFilter.value==='paid'&&(!x.payer_id||remaining===0));
   return matchesText&&(!categoryFilter.value||(x.category||'Khác')===categoryFilter.value)&&matchesStatus;
 });
 expenseList.innerHTML=visibleExpenses.length?visibleExpenses.map(x=>{
   const isPersonal=!!x.payer_id,paid=Number(x.paid_amount||0),remaining=Number(x.amount)-paid;
   const refundLabel=!isPersonal?'Trả trực tiếp từ quỹ':remaining===0?'Quỹ đã hoàn trả':paid>0?'Đã hoàn một phần: '+money(paid)+' / '+money(x.amount):'Quỹ còn nợ '+esc(x.payer_name||'thành viên');
   return `<div class="item record-row"><div class="record-main"><div class="record-title">${esc(x.title)}</div><div class="record-meta">${esc(x.spent_on)} · ${esc(x.category||'Khác')} · ${isPersonal?'Ứng bởi '+esc(x.payer_name||'thành viên'):'Lấy từ quỹ chung'}</div><div class="record-status ${isPersonal&&remaining>0?(paid>0?'record-status-partial':'record-status-due'):''}">${refundLabel}</div>${x.note?`<div class="record-note">${esc(x.note)}</div>`:''}</div><div class="record-meta">${money(x.amount)}</div>${canEdit?`<div class="record-buttons">${isPersonal&&remaining>0?`<button class="secondary compact record-payment" data-kind="expense" data-id="${esc(x.id)}" data-reverse="false">Ghi hoàn trả</button>`:''}${isPersonal&&paid>0?`<button class="secondary compact record-payment" data-kind="expense" data-id="${esc(x.id)}" data-reverse="true">Hoàn tác thanh toán</button>`:''}<button class="secondary compact edit-expense" data-id="${esc(x.id)}">Sửa</button><button class="danger compact delete-expense" data-id="${esc(x.id)}" data-title="${esc(x.title)}" aria-label="Xóa khoản chi ${esc(x.title)}">Xóa</button></div>`:''}</div>`;
 }).join(''):'<p class="muted ledger-empty">'+(expenses.length?'Không tìm thấy khoản chi phù hợp.':'Chưa có khoản chi. Thêm khoản chi đầu tiên.')+'</p>';
 contributionList.innerHTML=contributions.length?contributions.map(x=>`<div class="item record-row"><div class="record-main"><div class="record-title">${esc(x.note||'Đóng quỹ')}</div><div class="record-meta">${esc(x.paid_on)} · ${esc(x.payer_name)}</div></div><div class="record-meta">${money(x.amount)}</div>${canEdit?`<div class="record-buttons"><button class="secondary compact edit-contribution" data-id="${esc(x.id)}">Sửa</button><button class="danger compact delete-contribution" data-id="${esc(x.id)}" data-note="${esc(x.note||'Đóng quỹ')}" aria-label="Xóa khoản đóng quỹ">Xóa</button></div>`:''}</div>`).join(''):'<p class="muted ledger-empty">Chưa có khoản đóng thêm.</p>';
 expenseList.querySelectorAll('.edit-expense').forEach(button=>button.onclick=()=>openExpense(expenses.find(x=>x.id===button.dataset.id)));
 contributionList.querySelectorAll('.edit-contribution').forEach(button=>button.onclick=()=>openContribution(contributions.find(x=>x.id===button.dataset.id)));
 expenseList.querySelectorAll('.delete-expense').forEach(button=>button.onclick=()=>removeRecord('expenses',button,`Xóa khoản chi “${button.dataset.title}”? Thao tác này không thể hoàn tác.`));
 expenseList.querySelectorAll('.record-payment').forEach(button=>button.onclick=()=>openPaymentDialog(button.dataset.kind,button.dataset.id,button.dataset.reverse==='true'));
 contributionList.querySelectorAll('.delete-contribution').forEach(button=>button.onclick=()=>removeRecord('contributions',button,`Xóa khoản đóng quỹ “${button.dataset.note}”? Thao tác này không thể hoàn tác.`));
 const memberName=id=>members.find(m=>m.user_id===id)?.name||'Thành viên';
 const expenseBalances=window.TripTogetherFinance.calculateMemberBalances(members,displayExpenses,contributions,{spent,initial,actualFund});
 $('memberList').innerHTML=expenseBalances.length?expenseBalances.map(m=>`<div class="item member-row"><span class="item-title">${esc(m.name)}${m.id===trip.created_by?'<span class="creator-label" title="Trip creator">Host</span>':''}${m.outstanding?`<small class="member-outstanding">Quỹ còn nợ: ${money(m.outstanding)}</small>`:''}</span><span class="member-cell"><small class="member-mobile-label">Đã chi cá nhân</small><span class="member-value">${money(m.paid)}</span></span><span class="member-cell"><small class="member-mobile-label">Đã đóng quỹ</small><span class="member-value">${money(m.contributed)}</span></span><span class="member-cell"><small class="member-mobile-label">Phần chi</small><span class="member-value">${money(m.share)}</span></span></div>`).join(''):'<p class="muted ledger-empty">Chưa có thành viên.</p>';
 const requestPanel=$('editRequestPanel'), requestState=$('editRequestState'), requestBtn=$('requestEditBtn');
 const isHost=trip.created_by===user?.id, joined=members.some(m=>m.user_id===user?.id);
 requestPanel.classList.toggle('hidden',readOnly||!joined||isHost||canEdit);
 if(!readOnly&&joined&&!isHost&&!canEdit){
  const mine=editRequests.find(r=>r.user_id===user.id);
  requestState.textContent=!editRequestsAvailable?'Host cần cài trip_edit_requests.sql trên Supabase để bật yêu cầu cấp quyền.':mine?.status==='pending'?'Đang chờ Host duyệt yêu cầu.':mine?.status==='rejected'?'Yêu cầu trước đã bị từ chối. Bạn có thể gửi lại.':'Bạn hiện chỉ được xem. Gửi yêu cầu để Host cấp quyền sửa.';
  requestBtn.classList.toggle('hidden',!editRequestsAvailable||mine?.status==='pending');
 }
 const pendingRequests=editRequests.filter(r=>r.status==='pending');
 const hostRequestPanel=$('hostEditRequestsPanel'),hostRequestList=$('hostEditRequestsList');
 hostRequestPanel.classList.toggle('hidden',readOnly||!isHost);
 if(!readOnly&&isHost){
  hostRequestList.innerHTML=!editRequestsAvailable?'<p class="muted small">Hãy chạy trip_edit_requests.sql trong Supabase để nhận yêu cầu.</p>':pendingRequests.length?pendingRequests.map(r=>`<div class="member-permission-row"><span><b>${esc(r.name)}</b><small class="member-permission-status">Đang xin quyền chỉnh sửa</small></span><div class="section-actions"><button class="primary compact edit-request-review" data-user-id="${esc(r.user_id)}" data-approve="true">Duyệt</button><button class="secondary compact edit-request-review" data-user-id="${esc(r.user_id)}" data-approve="false">Từ chối</button></div></div>`).join(''):'<p class="muted small">Chưa có yêu cầu cấp quyền mới.</p>';
  hostRequestList.querySelectorAll('.edit-request-review').forEach(b=>b.onclick=()=>reviewEditRequest(b));
 }
 const permissionPanel=$('editPermissionsPanel'),permissionList=$('memberPermissionList');permissionPanel.classList.toggle('hidden',readOnly||trip.created_by!==user?.id);if(trip.created_by===user?.id&&!readOnly){if(!editPermissionsReady)permissionList.innerHTML='<p class="permission-migration-note">Để bật phân quyền riêng cho từng thành viên, hãy chạy member_edit_permissions.sql một lần trong Supabase SQL Editor. Các thành viên hiện tại vẫn giữ quyền sửa cho đến khi migration được cài.</p>';else{const joined=members.filter(m=>!m.is_guest&&m.user_id!==trip.created_by);permissionList.innerHTML='<p class="muted small">Chỉ thành viên đã tham gia bằng tài khoản đăng nhập mới hiện ở đây. Thành viên được thêm thủ công chưa có tài khoản nên chưa thể cấp quyền trực tiếp.</p>'+(joined.length?joined.map(m=>`<div class="member-permission-row"><span><b>${esc(m.name)}</b><small class="member-permission-status">${m.can_edit?'Có quyền chỉnh sửa':'Chỉ xem'}</small></span><button class="${m.can_edit?'secondary':'primary'} compact member-edit-toggle" data-user-id="${esc(m.user_id)}" data-allow="${m.can_edit?'false':'true'}">${m.can_edit?'Thu hồi quyền':'Cấp quyền sửa'}</button></div>`).join(''):'<p class="muted small">Chưa có thành viên đăng nhập nào để cấp quyền.</p>');permissionList.querySelectorAll('.member-edit-toggle').forEach(button=>button.onclick=()=>toggleMemberEdit(button))}}
 const expenseTransfers=settle(expenseBalances);$('expenseSettlements').innerHTML=expenseTransfers.length?expenseTransfers.map(t=>`<div class="settlement-row"><span>${esc(t.from)} → ${esc(t.to)}</span><b>${money(t.amount)}</b></div>`).join(''):'<p class="muted small">Quỹ đã cân đối theo phần đóng góp.</p>';
 const openDebts=displayDebts.filter(d=>Number(d.amount)>Number(d.paid_amount||0));
 $('debtList').innerHTML=displayDebts.length?displayDebts.map(d=>{
   const paid=Number(d.paid_amount||0),remaining=Number(d.amount)-paid;
   const state=remaining===0?'Đã thanh toán':paid>0?'Đã trả một phần: '+money(paid)+' / '+money(d.amount):'Chưa thanh toán';
   return `<div class="item record-row debt-row"><div class="record-main"><div class="record-title">${esc(memberName(d.debtor_id))} → ${esc(memberName(d.creditor_id))}</div><div class="record-meta">${esc(d.incurred_on)}${d.note?' · '+esc(d.note):''}</div><div class="record-status ${remaining>0?(paid>0?'record-status-partial':'record-status-due'):''}">${state}</div></div><div class="record-meta">${money(d.amount)}</div>${canEdit?`<div class="record-buttons">${remaining>0?`<button class="secondary compact record-payment" data-kind="debt" data-id="${esc(d.id)}" data-reverse="false">Ghi trả nợ</button>`:''}${paid>0?`<button class="secondary compact record-payment" data-kind="debt" data-id="${esc(d.id)}" data-reverse="true">Hoàn tác thanh toán</button>`:''}<button class="danger compact delete-debt" data-id="${esc(d.id)}" aria-label="Xóa khoản nợ">Xóa</button></div>`:''}</div>`;
 }).join(''):'<p class="muted ledger-empty">Chưa ghi khoản nợ nào.</p>';
 $('debtList').querySelectorAll('.record-payment').forEach(button=>button.onclick=()=>openPaymentDialog(button.dataset.kind,button.dataset.id,button.dataset.reverse==='true'));
 $('debtList').querySelectorAll('.delete-debt').forEach(button=>button.onclick=()=>removeRecord('member_debts',button,'Xóa khoản nợ này?'));
 const balances=members.map(m=>({id:m.user_id,name:m.name,b:openDebts.reduce((sum,d)=>{const due=Number(d.amount)-Number(d.paid_amount||0);return sum+(d.creditor_id===m.user_id?due:d.debtor_id===m.user_id?-due:0)},0)}));
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
  const entityNames={expenses:'Khoản chi',contributions:'Đóng quỹ',member_debts:'Nợ riêng',trip_payments:'Thanh toán'};
  const actionNames={INSERT:'Đã thêm',UPDATE:'Đã sửa',DELETE:'Đã xóa'};
  activityList.innerHTML=activityEvents.length?activityEvents.map(event=>{
   const d=event.after_data||event.before_data||{},entity=entityNames[event.source_table]||event.source_table;
   const title=d.title||d.note||d.payer_name||entity;
   const exists=event.source_table==='expenses'?expenses.some(x=>x.id===event.record_id):
     event.source_table==='contributions'?contributions.some(x=>x.id===event.record_id):true;
   const canRestore=canEdit&&event.action==='DELETE'&&!exists&&
     (event.source_table==='expenses'||event.source_table==='contributions');
   const actor=event.actor_id?memberDisplay(event.actor_id):'Hệ thống';
   return `<div class="item activity-entry"><div><b>${esc(actionNames[event.action]||event.action)} · ${esc(entity)}</b><small class="activity-meta">${esc(String(title).slice(0,70))} · ${esc(actor)} · ${esc(new Date(event.recorded_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}))}</small></div>${canRestore?`<button type="button" class="secondary compact restore-activity" data-id="${esc(event.id)}">Khôi phục</button>`:''}</div>`;
  }).join(''):'<p class="muted small">Chưa có thay đổi nào được ghi nhận.</p>';
  activityList.querySelectorAll('.restore-activity').forEach(button=>button.onclick=()=>restoreActivity(button));
 }
 $('deleteTripBtn').classList.toggle('hidden',readOnly||trip.created_by!==user.id);$('shareBtn').classList.toggle('hidden',readOnly);$('inviteBtn').classList.toggle('hidden',readOnly);$('leaveBtn').classList.toggle('hidden',readOnly);$('addExpense').classList.toggle('hidden',!canEdit);$('addContribution').classList.toggle('hidden',!canEdit);$('editInitialFundBtn').classList.toggle('hidden',!canEdit);$('addMember').classList.toggle('hidden',!canEdit);$('addDebt').classList.toggle('hidden',!canEdit);$('syncStatus').textContent=readOnly?'● Chế độ chỉ xem':canEdit?'● Đã đồng bộ':'● Chỉ xem · chưa được cấp quyền sửa';
}
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

async function removeRecord(table,button,message){if(!localizedConfirm(message))return;return withButtonLoading(button,'Removing…',async()=>{try{const {error}=await db.from(table).delete().eq('id',button.dataset.id).eq('trip_id',trip.id);if(error){localizedAlert(`Could not remove item: ${error.message}`);return}await refresh()}catch(error){localizedAlert(`Could not remove item: ${error.message}`)}})}
function openExpense(record=null){$('expenseForm').reset();$('expenseId').value=record?.id||'';$('expenseTitle').value=record?.title||'';$('expenseAmount').value=record?.amount||'';$('expenseDate').value=record?.spent_on||dateToday();$('expenseNote').value=record?.note||'';if(record?.category&&!Array.from($('expenseCategory').options).some(o=>o.value===record.category))$('expenseCategory').add(new Option(record.category,record.category));$('expenseCategory').value=record?.category||'Food';if(record?.payer_id)$('expensePayer').value=record.payer_id;$('expenseDialogTitle').textContent=record?'Sửa khoản chi':'Thêm khoản chi';$('expenseSave').textContent=record?'Lưu thay đổi':'Lưu khoản chi';$('expenseDialog').showModal()}
function openContribution(record=null){$('fundForm').reset();$('fundId').value=record?.id||'';$('fundAmount').value=record?.amount||'';$('fundDate').value=record?.paid_on||dateToday();$('fundNote').value=record?.note||'';if(record?.payer_id)$('fundPayer').value=record.payer_id;$('fundDialogTitle').textContent=record?'Sửa khoản đóng quỹ':'Đóng quỹ thêm';$('fundSave').textContent=record?'Lưu thay đổi':'Lưu khoản đóng';$('fundDialog').showModal()}
const settle = balances => window.TripTogetherFinance.settle(balances);
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function invite(ev){const button=ev?.currentTarget;if(!button)return;return withButtonLoading(button,'Đang tạo link…',async()=>{const url=location.origin+location.pathname+'?trip='+trip.invite_code;try{await navigator.clipboard.writeText(url);localizedAlert('Đã sao chép link xem (không cần mã). Chỉ chia sẻ với người đáng tin cậy.\n'+url)}catch{localizedAlert('Link xem chuyến đi (không cần mã, hãy giữ kín):\n'+url)}})}
$('expenseSearch').addEventListener('input',()=>{if(trip)render()});
$('expenseCategoryFilter').addEventListener('change',()=>{if(trip)render()});
$('expenseStatusFilter').addEventListener('change',()=>{if(trip)render()});
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));['expenses','fund','people'].forEach(k=>$(k+'Tab').classList.toggle('hidden',b.dataset.tab!==k))});
$('addExpense').onclick=()=>{if(!members.length)return;openExpense()};
$('expenseCancel').onclick=()=>{$('expenseDialog').close();$('expenseForm').reset()};
$('addMember').onclick=()=>{$('memberName').value='';$('memberDialog').showModal();$('memberName').focus()};
$('memberCancel').onclick=()=>{$('memberDialog').close();$('memberForm').reset()};
$('addDebt').onclick=()=>{if(members.length<2){localizedAlert('Cần ít nhất hai thành viên để ghi khoản nợ.');return}$('debtCreditor').innerHTML=members.map(m=>`<option value="${esc(m.user_id)}">${esc(m.name)}</option>`).join('');$('debtDebtor').innerHTML=$('debtCreditor').innerHTML;$('debtAmount').value='';$('debtNote').value='';$('debtDate').value=dateToday();$('debtDialog').showModal()};
$('debtCancel').onclick=()=>{$('debtDialog').close();$('debtForm').reset()};
$('debtForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='debtSave')return;ev.preventDefault();const debtorId=$('debtDebtor').value,creditorId=$('debtCreditor').value;if(debtorId===creditorId){localizedAlert('Người nợ và người nhận nợ phải khác nhau.');return}await withButtonLoading($('debtSave'),'Đang lưu…',async()=>{try{const {error}=await db.from('member_debts').insert({trip_id:trip.id,debtor_id:debtorId,creditor_id:creditorId,amount:Number($('debtAmount').value),note:$('debtNote').value.trim(),incurred_on:$('debtDate').value,created_by:user.id});if(error){localizedAlert('Không thể lưu khoản nợ: '+error.message);return}$('debtDialog').close();$('debtForm').reset();await refresh()}catch(error){localizedAlert('Không thể lưu khoản nợ: '+error.message)}})});
$('memberForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='memberSave')return;ev.preventDefault();const name=$('memberName').value.trim();if(!name)return;await withButtonLoading($('memberSave'),'Saving…',async()=>{try{const {error}=await db.rpc('add_guest_member',{p_trip_id:trip.id,p_name:name});if(error){localizedAlert('Could not add member: '+error.message+' If this feature is not installed in Supabase yet, run add_member.sql from the TripTogether folder in SQL Editor.');return}$('memberDialog').close();$('memberForm').reset();await refresh()}catch(error){localizedAlert('Could not add member: '+error.message)}})});
$('expenseForm').addEventListener('submit',async ev=>{
 if(ev.submitter?.id!=='expenseSave')return;ev.preventDefault();
 const id=$('expensePayer').value,p=members.find(x=>x.user_id===id),editId=$('expenseId').value,existing=expenses.find(x=>x.id===editId),reimbursed=!!p&&!!existing?.reimbursed;
 await withButtonLoading($('expenseSave'),'Đang lưu…',async()=>{try{
  const payload={title:$('expenseTitle').value.trim(),amount:Number($('expenseAmount').value),payer_id:p?.user_id||null,payer_name:p?.name||'Quỹ chung',category:$('expenseCategory').value,spent_on:$('expenseDate').value,note:$('expenseNote').value.trim(),reimbursed,reimbursed_at:reimbursed?existing.reimbursed_at:null};
  const result=editId?await db.from('expenses').update(payload).eq('id',editId).eq('trip_id',trip.id):await db.from('expenses').insert({...payload,trip_id:trip.id,created_by:user.id});
  if(result.error){localizedAlert('Không thể lưu khoản chi: '+result.error.message);return}$('expenseDialog').close();$('expenseForm').reset();await refresh()
 }catch(error){localizedAlert('Không thể lưu khoản chi: '+error.message)}})
});
$('addContribution').onclick=()=>openContribution();
$('fundCancel').onclick=()=>{$('fundDialog').close();$('fundForm').reset()};
$('fundForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='fundSave')return;ev.preventDefault();const id=$('fundPayer').value,p=members.find(x=>x.user_id===id);if(!p)return;await withButtonLoading($('fundSave'),'Đang lưu…',async()=>{try{const payload={amount:Number($('fundAmount').value),payer_id:id,payer_name:p.name,note:$('fundNote').value.trim(),paid_on:$('fundDate').value};const editId=$('fundId').value;const result=editId?await db.from('contributions').update(payload).eq('id',editId).eq('trip_id',trip.id):await db.from('contributions').insert({...payload,trip_id:trip.id,created_by:user.id});if(result.error){localizedAlert('Không thể lưu khoản đóng quỹ: '+result.error.message);return}$('fundDialog').close();$('fundForm').reset();await refresh()}catch(error){localizedAlert('Không thể lưu khoản đóng quỹ: '+error.message)}})});
$('editInitialFundBtn').onclick=()=>{$('initialFundInput').value=Number(trip.initial_fund||0);$('initialFundDialog').showModal()};
$('initialFundCancel').onclick=()=>{$('initialFundDialog').close();$('initialFundForm').reset()};
$('initialFundForm').addEventListener('submit',async ev=>{if(ev.submitter?.id!=='initialFundSave')return;ev.preventDefault();const amount=Number($('initialFundInput').value);await withButtonLoading($('initialFundSave'),'Đang lưu…',async()=>{try{const {error}=await db.from('trips').update({initial_fund:amount}).eq('id',trip.id);if(error){localizedAlert('Không thể lưu quỹ ban đầu: '+error.message);return}trip.initial_fund=amount;$('initialFundDialog').close();await refresh()}catch(error){localizedAlert('Không thể lưu quỹ ban đầu: '+error.message)}})});
$('leaveBtn').onclick=()=>{if(!localizedConfirm('Leave this trip on this device?'))return;return withButtonLoading($('leaveBtn'),'Loading…',async()=>{++refreshSequence;if(channel){await db.removeChannel(channel);channel=null}if(viewerTimer){clearInterval(viewerTimer);viewerTimer=null}if(editRequestTimer){clearInterval(editRequestTimer);editRequestTimer=null}trip=null;history.replaceState({},'',location.pathname);$('app').classList.add('hidden');$('welcome').classList.remove('hidden');$('shareBtn').classList.add('hidden');await loadMyTrips()})};
$('deleteTripBtn').onclick=()=>{if(trip.created_by!==user.id)return;if(!localizedConfirm(`Delete “${trip.name}” and permanently remove all its expenses, deposits, and members? This cannot be undone.`))return;return withButtonLoading($('deleteTripBtn'),'Deleting…',async()=>{try{const {error}=await db.rpc('delete_trip',{p_trip_id:trip.id});if(error){localizedAlert(`Could not delete trip: ${error.message}\nIf delete-trip support is not installed yet, run delete_trip.sql in the Supabase SQL Editor.`);return}++refreshSequence;if(channel)await db.removeChannel(channel);channel=null;if(editRequestTimer){clearInterval(editRequestTimer);editRequestTimer=null}if(viewerTimer){clearInterval(viewerTimer);viewerTimer=null}trip=null;history.replaceState({},'',location.pathname);$('app').classList.add('hidden');$('welcome').classList.remove('hidden');$('shareBtn').classList.add('hidden');await loadMyTrips()}catch(error){localizedAlert(`Could not delete trip: ${error.message}`)}})};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&trip)void refresh()});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
init();
