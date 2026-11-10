/* Multi-currency expenses. Pure helpers: no DOM, no Supabase.
 * The trip ledger stays in VND: `amount` is always the VND value every balance uses.
 * A foreign expense additionally stores its original amount, ISO currency and the rate used.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TripTogetherCurrency=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 const BASE='VND';
 // Popular destinations for Vietnamese travellers first, then major world currencies.
 const CURRENCIES=[
  ['VND','Việt Nam Đồng',0],['USD','Đô la Mỹ',2],['EUR','Euro',2],['JPY','Yên Nhật',0],['KRW','Won Hàn Quốc',0],
  ['THB','Baht Thái',2],['SGD','Đô la Singapore',2],['CNY','Nhân dân tệ',2],['TWD','Đô la Đài Loan',0],['HKD','Đô la Hồng Kông',2],
  ['MYR','Ringgit Malaysia',2],['IDR','Rupiah Indonesia',0],['PHP','Peso Philippines',2],['LAK','Kíp Lào',0],['KHR','Riel Campuchia',0],
  ['AUD','Đô la Úc',2],['GBP','Bảng Anh',2],['CAD','Đô la Canada',2],['CHF','Franc Thụy Sĩ',2],['NZD','Đô la New Zealand',2],
  ['AED','Dirham UAE',2],['INR','Rupee Ấn Độ',2]
 ].map(([code,name,decimals])=>({code,name,decimals}));
 const byCode=Object.fromEntries(CURRENCIES.map(c=>[c.code,c]));
 const MAX_VND=9e15; // numeric(16,0) in the database

 function isSupported(code){return Object.hasOwn(byCode,String(code||''))}
 function decimals(code){return isSupported(code)?byCode[code].decimals:2}

 /* Parse what people actually type, in either convention:
  *  "12.50" / "12,5"        → 12.5   (one separator followed by 1–2 digits = decimal)
  *  "25.400" / "1,000"      → 25400 / 1000 (one separator followed by exactly 3 digits = thousands)
  *  "1.234,56" / "1,234.56" → 1234.56 (both present: the last one is the decimal separator)
  *  "1.234.567"             → 1234567 (repeated separator = thousands)
  * Returns NaN for anything else (letters, negative numbers, empty input).
  */
 function parseAmount(input){
  let s=String(input??'').trim().replace(/[\s ']/g,'');
  if(!s||!/^[0-9.,]+$/.test(s))return NaN;
  const dots=(s.match(/\./g)||[]).length,commas=(s.match(/,/g)||[]).length;
  if(dots&&commas){
   const dec=s.lastIndexOf('.')>s.lastIndexOf(',')?'.':',',thou=dec==='.'?',':'.';
   if((s.match(new RegExp('\\'+dec,'g'))||[]).length>1)return NaN;
   s=s.split(thou).join('').replace(dec,'.');
  }else if(dots||commas){
   const sep=dots?'.':',',count=dots||commas,tail=s.slice(s.lastIndexOf(sep)+1);
   if(count>1||tail.length===3)s=s.split(sep).join('');
   else s=s.replace(sep,'.');
  }
  if(!/^\d+(\.\d+)?$/.test(s))return NaN;
  return Number(s);
 }

 // Localised currency name ("Đô la Mỹ" / "US Dollar"); falls back to the built-in Vietnamese name.
 function displayName(code,lang='vi'){
  if(lang==='vi'||typeof Intl.DisplayNames!=='function')return byCode[code]?.name||code;
  try{return new Intl.DisplayNames([lang],{type:'currency'}).of(code)||byCode[code]?.name||code}catch{return byCode[code]?.name||code}
 }
 function toVnd(original,rate){return Math.round(Number(original)*Number(rate))}

 /* Validate a foreign-currency entry. Returns '' when valid, otherwise a Vietnamese message. */
 function validate({currency,original,rate}){
  if(currency===BASE)return '';
  if(!isSupported(currency))return 'Loại tiền tệ không được hỗ trợ.';
  const o=Number(original),r=Number(rate);
  if(!Number.isFinite(o)||o<=0)return 'Vui lòng nhập số tiền gốc lớn hơn 0.';
  const places=(String(original).split('.')[1]||'').length;
  if(places>decimals(currency))return currency+' chỉ dùng tối đa '+decimals(currency)+' chữ số thập phân.';
  if(!Number.isFinite(r)||r<=0)return 'Vui lòng nhập tỷ giá lớn hơn 0.';
  if(r>1e9)return 'Tỷ giá không hợp lệ.';
  const vnd=toVnd(o,r);
  if(vnd<1)return 'Số tiền quy đổi phải ít nhất 1 ₫.';
  if(!Number.isSafeInteger(vnd)||vnd>MAX_VND)return 'Số tiền quy đổi quá lớn.';
  return '';
 }

 function formatOriginal(value,code,locale='vi-VN'){
  const d=decimals(code);
  try{return new Intl.NumberFormat(locale,{style:'currency',currency:code,minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(value))}
  catch{return Number(value).toLocaleString(locale)+' '+code}
 }
 function formatRate(rate,locale='vi-VN'){
  return Number(rate).toLocaleString(locale,{maximumFractionDigits:Number(rate)<100?4:2});
 }
 // "100,00 US$ · 1 USD = 25.400 ₫" — shown under the VND amount of a foreign expense.
 function describe(expense,locale='vi-VN'){
  if(!expense||!expense.currency||expense.currency===BASE||expense.original_amount==null||expense.fx_rate==null)return '';
  return formatOriginal(expense.original_amount,expense.currency,locale)+' · 1 '+expense.currency+' = '+formatRate(expense.fx_rate,locale)+' ₫';
 }

 /* Today's rate from a free, key-less API that includes VND (ECB-based APIs do not).
  * `fetchImpl` is injectable for tests. Returns VND per 1 unit of `code`. */
 async function fetchRate(code,fetchImpl=(typeof fetch==='function'?fetch:null)){
  if(!isSupported(code)||code===BASE)throw new Error('Loại tiền tệ không hợp lệ.');
  if(!fetchImpl)throw new Error('Thiết bị không hỗ trợ lấy tỷ giá tự động.');
  const response=await fetchImpl('https://open.er-api.com/v6/latest/'+encodeURIComponent(code),{cache:'no-store'});
  if(!response.ok)throw new Error('Không lấy được tỷ giá (HTTP '+response.status+').');
  const data=await response.json();
  const rate=Number(data?.rates?.[BASE]);
  if(data?.result!=='success'||!Number.isFinite(rate)||rate<=0)throw new Error('Không lấy được tỷ giá VND cho '+code+'.');
  return Math.round(rate*10000)/10000;
 }

 /* Default currency for a NEW expense: the one used most in the trip's latest expenses (ties → the
  * most recent), so a week in Thailand defaults to THB even after one VND airport coffee.
  * The rate is the latest one recorded for that currency in this trip. Shared data, so every member
  * and device gets the same default. Returns null when the trip has no foreign expense yet. */
 function suggestDefault(expenses,window=10){
  const recent=[...(expenses||[])].filter(e=>e&&e.created_at)
   .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,window);
  if(!recent.length)return null;
  const counts=new Map();
  recent.forEach((e,i)=>{const c=isSupported(e.currency)?e.currency:BASE;const v=counts.get(c)||{n:0,first:i};v.n++;counts.set(c,v)});
  const [currency]=[...counts.entries()].sort((a,b)=>b[1].n-a[1].n||a[1].first-b[1].first)[0];
  if(currency===BASE)return null;
  const withRate=[...(expenses||[])].filter(e=>e.currency===currency&&Number(e.fx_rate)>0)
   .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  return {currency,rate:withRate.length?Number(withRate[0].fx_rate):null};
 }

 return {BASE,CURRENCIES,isSupported,decimals,displayName,suggestDefault,parseAmount,toVnd,validate,formatOriginal,formatRate,describe,fetchRate};
});
