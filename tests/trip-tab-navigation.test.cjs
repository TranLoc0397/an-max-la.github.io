const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const classes=(initial=[])=>{
 const set=new Set(initial);
 return {add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x),toggle:(x,force)=>{
  const next=force===undefined?!set.has(x):!!force;
  if(next)set.add(x);else set.delete(x);
  return next;
 }};
};
const element=(data,initial=[])=>({
 dataset:data||{},classList:classes(initial),attrs:{},
 setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}
});
test('shell navigation keeps top tabs, panels and bottom navigation in sync',()=>{
 const app=element({},[]);
 const panels=Object.fromEntries(['expenses','fund','people'].map(x=>[x+'Tab',element({},x==='expenses'?[]:['hidden'])]));
 const topTabs=['expenses','fund','people'].map(tab=>element({tab},tab==='expenses'?['active']:[]));
 const bottomNav=['overview','expenses','fund','people'].map(shellView=>element({shellView}));
 const root={app,...panels};
 const document={
  getElementById:id=>root[id]||null,
  querySelectorAll:selector=>{
   if(selector==='.tabs .tab[data-tab]')return topTabs;
   if(selector==='[data-shell-view]')return bottomNav;
   return [];
  },
  addEventListener(){}
 };
 const window={};
 vm.runInNewContext(read('ui-shell.js'),{document,window,matchMedia:()=>({matches:true})});
 window.TripTogetherShell.activate('people',false);
 assert.equal(app.dataset.shellView,'people');
 assert.equal(app.classList.contains('tt-overview-mode'),false);
 assert.deepEqual(topTabs.map(t=>t.classList.contains('active')),[false,false,true]);
 assert.deepEqual(['expensesTab','fundTab','peopleTab'].map(k=>panels[k].classList.contains('hidden')),[true,true,false]);
 assert.equal(bottomNav.find(n=>n.dataset.shellView==='people').attrs['aria-current'],'page');
 window.TripTogetherShell.activate('fund',false);
 assert.deepEqual(topTabs.map(t=>t.classList.contains('active')),[false,true,false]);
 assert.deepEqual(['expensesTab','fundTab','peopleTab'].map(k=>panels[k].classList.contains('hidden')),[true,false,true]);
 window.TripTogetherShell.activate('overview',false);
 assert.equal(app.classList.contains('tt-overview-mode'),true);
 assert.equal(app.dataset.shellView,'overview');
});
test('top tab clicks delegate to unified shell controller',()=>{
 const app=read('app.js'),shell=read('ui-shell.js');
 assert.match(app,/window\.TripTogetherShell\.activate\(view,false\)/);
 assert.match(shell,/pick\(key\+'Tab'\)\?\.classList\.toggle\('hidden',key!==view\)/);
 assert.doesNotMatch(shell,/tab\?\.click\(\)/);
 assert.match(app,/tt-overview-mode/);
});
