import {build} from "esbuild";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {resolve} from "node:path";
const root=process.cwd(),out=resolve(root,"android/app/build/generated/mezgebUi/assets/mezgeb-ui");
const HOST="https://mezgeb-omega.vercel.app",PROJECT="pqfzkyssvxmboprkmdga",PREFIX="/__mezgeb_native__/1.1.0";
function validKey(k){if(typeof k!=="string"||k.startsWith("sb_secret_"))return false;if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(k))return true;try{const payload=JSON.parse(Buffer.from(k.split(".")[1],"base64url").toString());return payload.role==="anon"&&payload.ref===PROJECT;}catch{return false;}}
async function publicConfig(){
 const configured=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(validKey(configured)&&process.env.NEXT_PUBLIC_SUPABASE_URL==="https://"+PROJECT+".supabase.co")return configured;
 // Discover only credentials intentionally published in the existing production browser assets.
 // Never read server env files or service-role keys. Fail closed if absent or ambiguous.
 try{const response=await fetch(HOST+"/",{signal:AbortSignal.timeout(12000),redirect:"error"});if(!response.ok)return "";const html=await response.text();const paths=[...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]))].filter(p=>p.startsWith("/_next/static/")&&p.endsWith(".js")).slice(0,36);const candidates=new Set();await Promise.all(paths.map(async p=>{try{const res=await fetch(HOST+p,{signal:AbortSignal.timeout(8000),redirect:"error"});if(!res.ok)return;const js=await res.text();for(const k of js.match(/eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+/g)||[])if(validKey(k))candidates.add(k);if(js.includes(PROJECT+".supabase.co"))for(const k of js.match(/sb_publishable_[A-Za-z0-9_-]+/g)||[])if(validKey(k))candidates.add(k);}catch{}}));return candidates.size===1?[...candidates][0]:"";}catch{return "";}
}
const key=await publicConfig();
console.log("Mezgeb Android public cloud configuration: "+(key?"verified public client configuration":"local ledger + hosted account fallback"));
await mkdir(out,{recursive:true});
await build({entryPoints:[resolve(root,"src/native/entry.tsx")],outdir:out,bundle:true,minify:true,format:"iife",platform:"browser",target:["chrome90"],jsx:"automatic",entryNames:"app",assetNames:"fonts/[name]-[hash]",publicPath:PREFIX,alias:{"@":resolve(root,"src"),"next/link":resolve(root,"src/native/link.tsx"),"next/navigation":resolve(root,"src/native/navigation.ts")},loader:{".woff2":"file",".woff":"file",".ttf":"file",".svg":"file"},define:{"process.env.NODE_ENV":JSON.stringify("production"),"process.env.NEXT_PUBLIC_SUPABASE_URL":JSON.stringify(key?"https://"+PROJECT+".supabase.co":""),"process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY":JSON.stringify(key),"process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY":JSON.stringify("")},logLevel:"info"});
await writeFile(resolve(out,"index.html"),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#e0e5fb"><title>Mezgeb Signature Edition</title><link rel="stylesheet" href="'+PREFIX+'/app.css"></head><body><div id="root"><main style="min-height:100vh;display:grid;place-content:center;text-align:center;font:18px system-ui;color:#4925f5"><h1>መዝገብ</h1><p>Opening Mezgeb…</p></main></div><script defer src="'+PREFIX+'/app.js"></script></body></html>');
await writeFile(resolve(out,"build.json"),JSON.stringify({version:"1.1.0",cloudConfigured:Boolean(key),origin:HOST}));
await readFile(resolve(out,"app.js"));
