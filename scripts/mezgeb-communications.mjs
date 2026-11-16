import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const dir='docs/email-templates', project='pqfzkyssvxmboprkmdga';
const manifest=JSON.parse(await fs.readFile(dir+'/manifest.json','utf8'));
const sms=JSON.parse(await fs.readFile('docs/sms-templates/catalog.json','utf8'));
const locales=['en','am','om'];
assert.equal(manifest.length,13);assert.equal(new Set(manifest.map(x=>x.key)).size,13);
assert.equal(sms.length,19);assert.equal(new Set(sms.map(x=>x.id)).size,19);
const payload={};
for(const item of manifest){
 const html=await fs.readFile(dir+'/'+item.file,'utf8');
 assert(html.includes('Mezgeb')&&html.includes('mezgeb-email-logo.png')&&html.includes('<table')&&!/<script\b/i.test(html));
 assert(!/sb_secret_|service_role|SUPABASE_ACCESS_TOKEN/.test(html));
 const vars=[...html.matchAll(/{{\s*(\.[A-Za-z]+)\s*}}/g)].map(x=>x[1]);
 const permitted=item.kind==='link'?['.ConfirmationURL']:item.kind==='code'?['.Token']:item.key.startsWith('identity_')?['.Provider']:item.key.startsWith('mfa_')?['.FactorType']:[];
 assert(vars.every(v=>permitted.includes(v)),'Unsupported variable: '+item.key);
 if(item.kind!=='security')assert(vars.includes(permitted[0])&&html.includes('.Data.locale'));
 for(const lang of locales){
  const h=await fs.readFile(dir+'/'+lang+'/'+item.file,'utf8'),t=await fs.readFile(dir+'/'+lang+'/'+item.key+'.txt','utf8');
  assert(h.includes('lang="'+lang+'"')&&t.includes(item.subjects[lang])&&item.preheaders[lang]);
 }
 payload['mailer_subjects_'+item.key]=item.subject;
 payload['mailer_templates_'+item.key+'_content']=html;
 if(item.notificationFlag)payload[item.notificationFlag]=true;
}
for(const x of sms){assert.equal(x.enabled,false);for(const lang of locales){const t=x.copy[lang];assert(t&&t.length<=300);assert.equal(t.includes('{code}'),x.category==='auth');assert(!/https?:\/\/|password is|balance:|ETB /i.test(t));}}
console.log('Validated 13 deployment emails, 39 localized HTML/text pairs and 57 SMS messages. No live sends.');
const args=process.argv.slice(2);if(!args.length)process.exit(0);
assert(args.includes('--reviewed'),'Human review and staging delivery verification required.');
const token=process.env.SUPABASE_ACCESS_TOKEN;assert(token,'Set the owner access token privately.');
const url='https://api.supabase.com/v1/projects/'+project+'/config/auth';
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function request(method,body){const res=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});if(!res.ok)throw Error('Auth config '+method+' failed: HTTP '+res.status);return method==='GET'?res.json():null;}
const current=await request('GET');const keys=Object.keys(payload);
assert(keys.every(k=>Object.hasOwn(current,k)),'Live config differs from reviewed mapping. Stop; inspect current schema.');
if(args[0]==='--apply'){
 assert(args.length===2,'Use --apply --reviewed only.');
 const logo=await fetch('https://mezgeb-omega.vercel.app/mezgeb-email-logo.png',{signal:AbortSignal.timeout(12000),redirect:'error'});assert(logo.ok&&logo.headers.get('content-type')?.includes('image/png'),'Deploy logo before applying.');
 const backup=path.join(os.homedir(),'mezgeb-email-backup-'+Date.now()+'.json');
 await fs.writeFile(backup,JSON.stringify({project,settings:Object.fromEntries(keys.map(k=>[k,current[k]]))},null,2),{mode:0o600,flag:'wx'});
 console.log('Backup saved outside repository: '+backup);
 await request('PATCH',payload);const checked=await request('GET');assert(keys.every(k=>checked[k]===payload[k]),'Readback mismatch; review and rollback.');
 console.log('Templates verified in live config. SMTP delivery is NOT verified by this command.');
}else if(args[0]==='--rollback'){
 assert(args.length===3&&path.isAbsolute(args[1]),'Use --rollback /absolute/backup.json --reviewed');
 const backup=JSON.parse(await fs.readFile(args[1],'utf8'));assert.equal(backup.project,project);assert(Object.keys(backup.settings).length===keys.length&&keys.every(k=>Object.hasOwn(backup.settings,k)));
 await request('PATCH',backup.settings);const checked=await request('GET');assert(keys.every(k=>checked[k]===backup.settings[k]));console.log('Owned email settings restored.');
}else throw Error('Unknown command');
