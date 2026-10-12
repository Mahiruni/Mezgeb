/* Mezgeb local-first app shell cache. No financial documents are stored in CacheStorage. */
const CACHE="mezgeb-shell-v1";
const PAGES=["/","/ledger","/receipts","/reports","/dube","/settings","/plans"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PAGES)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("mezgeb-shell-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
 const url=new URL(req.url);
 if(url.pathname.startsWith("/api/")||url.pathname.startsWith("/auth/")||url.searchParams.has("_rsc"))return;
 if(req.mode==="navigate"){
  event.respondWith(fetch(req).then(res=>{if(res.ok&&res.type==="basic"){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;}).catch(async()=>await caches.match(req)||await caches.match("/")));
  return;
 }
 if(url.pathname.startsWith("/_next/static/")||url.pathname==="/icon.svg"){
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;})));
 }
});
