const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function load(){
 class FakeInput{constructor(){this._v='';this.attrs={};this.dataset={};this.validity='';this.form=null}getAttribute(k){return k in this.attrs?this.attrs[k]:null}setCustomValidity(m){this.validity=m}addEventListener(){}setSelectionRange(){}}
 Object.defineProperty(FakeInput.prototype,'value',{configurable:true,get(){return this._v},set(v){this._v=String(v)}});
 const ctx={HTMLInputElement:FakeInput,document:{readyState:'complete',querySelectorAll:()=>[],activeElement:null}};
 const src=fs.readFileSync(path.join(__dirname,'..','money-input.js'),'utf8');
 const g={...ctx};g.globalThis=g;
 new Function('globalThis','HTMLInputElement','document',src)(g,FakeInput,ctx.document);
 return {api:g.TTMoneyInput,FakeInput};
}

test('formats amounts with Vietnamese thousands separators',()=>{
 const {api}=load();
 assert.equal(api.format('59999999'),'59.999.999');
 assert.equal(api.format('1000'),'1.000');
 assert.equal(api.format('999'),'999');
 assert.equal(api.format('0'),'0');
 assert.equal(api.format(''),'');
 assert.equal(api.format('00250000'),'250.000');
 assert.equal(api.format('59.999.999'),'59.999.999');
});

test('database decimals are rounded, not concatenated',()=>{
 const {api}=load();
 assert.equal(api.format(api.normalize('872000.00')),'872.000');
 assert.equal(api.format(api.normalize(872000)),'872.000');
 // While typing, a dot is a thousands separator, never a decimal point.
 assert.equal(api.format('1.000'),'1.000');
 assert.equal(api.format('59.9991'),'599.991');
});

test('enhanced input shows separators but app code reads plain digits',()=>{
 const {api,FakeInput}=load();
 const input=new FakeInput();input.attrs.min='1';
 api.enhance(input);
 input.value='59999999';
 assert.equal(input._v,'59.999.999');
 assert.equal(input.value,'59999999');
 assert.equal(Number(input.value),59999999);
 input.value='872000.00';
 assert.equal(input.value,'872000');
 input.value='0';
 assert.match(input.validity,/từ 1/);
 input.value='';
 assert.equal(input.validity,'');
});

test('max is enforced for payment amounts',()=>{
 const {api,FakeInput}=load();
 const input=new FakeInput();input.attrs.min='1';input.attrs.max='872000';
 api.enhance(input);
 input.value='900000';
 assert.match(input.validity,/872\.000/);
 input.value='872000';
 assert.equal(input.validity,'');
});

test('all money inputs in the app are enhanced',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 for(const id of ['paymentAmount','tripInitialFund','expenseAmount','fundAmount','initialFundInput','memberOpeningFund','debtAmount'])
  assert.match(html,new RegExp('<input id="'+id+'" data-money type="text" inputmode="numeric"'));
 assert.doesNotMatch(html,/type="number"/);
 assert.ok(html.indexOf('money-input.js')<html.indexOf('app.js?v='));
});
