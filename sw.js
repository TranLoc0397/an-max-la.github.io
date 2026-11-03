const CACHE='triptogether-v43';
const FILES=['./','./index.html','./styles.css','./app.js','./i18n.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(async c=>{await Promise.all(FILES.map(async path=>{const response=await fetch(path+'?cache='+CACHE,{cache:'reload'});if(!response.ok)throw new Error('Could not cache '+path);await c.put(path,response)}))}).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('triptogether-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method==='GET' && new URL(e.request.url).origin===location.origin)e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
