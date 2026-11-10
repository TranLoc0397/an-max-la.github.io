// A merge once dropped the closing brace of an @container block; every rule after it silently
// stopped applying (menus, sort toolbar, split UI) while every string-matching test still passed.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
for(const file of fs.readdirSync(path.join(__dirname,'..')).filter(f=>f.endsWith('.css'))){
 test(file+' has balanced braces and no merge markers',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  assert.doesNotMatch(css,/^(<<<<<<<|=======|>>>>>>>)/m,'leftover merge conflict marker');
  const code=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'""');
  let depth=0,line=1,open=[];
  for(const ch of code){
   if(ch==='\n')line++;
   else if(ch==='{'){depth++;open.push(line)}
   else if(ch==='}'){depth--;open.pop();assert.ok(depth>=0,'unexpected } on line '+line)}
  }
  assert.equal(depth,0,'unclosed { opened on line '+open.join(', '));
 });
}
