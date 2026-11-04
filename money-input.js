/* Money inputs: show thousands separators (59.999.999) while app code keeps reading/writing plain digits via .value. */
(function(root){
 'use strict';
 const native=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
 const digits=text=>String(text??'').replace(/\D/g,'').replace(/^0+(?=\d)/,'');
 const normalize=v=>typeof v==='number'||/^\s*\d+(\.\d+)?\s*$/.test(String(v??''))?String(Math.round(Number(v))):v;
 const format=text=>{const d=digits(text);return d?d.replace(/\B(?=(\d{3})+(?!\d))/g,'.'):''};

 function validate(input){
  const raw=digits(native.get.call(input));
  const min=input.getAttribute('min'),max=input.getAttribute('max');
  let message='';
  if(raw&&min!==null&&Number(raw)<Number(min))message='Số tiền phải từ '+format(min)+' trở lên.';
  else if(raw&&max!==null&&max!==''&&Number(raw)>Number(max))message='Số tiền tối đa là '+format(max)+'.';
  else if(raw&&!Number.isSafeInteger(Number(raw)))message='Số tiền quá lớn.';
  input.setCustomValidity(message);
 }

 function reformat(input){
  const before=native.get.call(input);
  const caret=input.selectionStart??before.length;
  const digitsBeforeCaret=digits(before.slice(0,caret)).length;
  const next=format(before);
  native.set.call(input,next);
  // Put the caret back after the same number of digits it was after before formatting.
  let pos=0,seen=0;
  while(pos<next.length&&seen<digitsBeforeCaret){if(/\d/.test(next[pos]))seen++;pos++}
  if(document.activeElement===input)input.setSelectionRange(pos,pos);
  validate(input);
 }

 function enhance(input){
  if(input.dataset.moneyReady)return;
  input.dataset.moneyReady='1';
  input.type='text';
  input.inputMode='numeric';
  input.autocomplete='off';
  Object.defineProperty(input,'value',{
   configurable:true,
   get(){return digits(native.get.call(this))},
   set(v){native.set.call(this,format(normalize(v)));validate(this)}
  });
  native.set.call(input,format(native.get.call(input)));
  input.addEventListener('input',()=>reformat(input));
  input.addEventListener('blur',()=>validate(input));
  input.form?.addEventListener('reset',()=>setTimeout(()=>validate(input)));
  validate(input);
 }

 function init(){document.querySelectorAll('input[data-money]').forEach(enhance)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 root.TTMoneyInput={enhance,format,digits,normalize};
})(globalThis);
