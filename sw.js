const CACHE='triptogether-v125'
const FILES=['./','./index.html','./styles.css','./airport-background.css','./app.js','./i18n.js','./finance.js','./trip-ui.js','./ui-shell.js','./icons.js','./money-input.js','./currency.js','./split.js','./receipts.js','./excel-backup.js','./fund-reminders.js','./manifest.webmanifest','./icon.svg','./triptogether-purple-icon.svg','./triptogether-purple-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(async c=>{await Promise.all(FILES.map(async path=>{const response=await fetch(path+'?cache='+CACHE,{cache:'reload'});if(!response.ok)throw new Error('Could not cache '+path);await c.put(path,response)}))}).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('triptogether-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const request=e.request;
 if(request.method!=='GET'||new URL(request.url).origin!==location.origin)return;
 // Pages: network first. A cached index.html must never be paired with newer scripts after a deploy;
 // the cached copy is only an offline fallback.
 if(request.mode==='navigate'){
  e.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put('./',copy))}
   return response;
  }).catch(()=>caches.match('./').then(r=>r||caches.match('./index.html'))));
  return;
 }
 e.respondWith(caches.match(request).then(r=>r||fetch(request)));
});
