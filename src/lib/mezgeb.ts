import Dexie, { type Table } from "dexie";
import { z } from "zod";

/** Monetary values are integer cents, never floating-point ledger balances. */
export type EntryType = "sale" | "expense";
export type Receipt = { number: string; status: "draft" | "legacy" };
export type Entry = { id: string; type: EntryType; cents: number; category: string; pay: string; note: string; createdAt: number; date: string; receipt: Receipt | null };
export type CreditEvent = { id: string; type: "credit" | "payment"; cents: number; note: string; createdAt: number };
export type Customer = { id: string; name: string; phone: string; events: CreditEvent[] };
export type Locale = "en" | "am" | "om" | "ti" | "so" | "aa" | "ar";
export type Business = { name: string; tin: string; phone: string; vatRegistered: boolean };
export type Document = { version: 2; business: Business; locale: Locale; theme: "light" | "dark"; entries: Entry[]; customers: Customer[]; nextDraft: number; updatedAt: number };

export const localeOptions: { code: Locale; label: string }[] = [
  {code:"en",label:"English"},{code:"am",label:"አማርኛ"},{code:"om",label:"Afaan Oromoo"},
  {code:"ti",label:"ትግርኛ"},{code:"so",label:"Af Soomaali"},{code:"aa",label:"Qafár af"},{code:"ar",label:"العربية"}
];
export const payments = ["Cash","Telebirr","CBE Birr","Chapa","M-Pesa","Amhara Bank","Awash Bank","Dashen Bank","Bank of Abyssinia","Enat Bank","Oromia Bank","Other Bank"];
export const saleCategories = ["Product sale","Service","Other income"];
export const expenseCategories = ["Stock purchase","Utilities","Rent","Transport","Salary","Other expense"];
export const initialDocument = (): Document => ({
  version:2, business:{name:"",tin:"",phone:"",vatRegistered:true},
  locale:"en",theme:"light",entries:[],customers:[],nextDraft:1,updatedAt:Date.now()
});

const finiteMoney = z.number().int().nonnegative().safe();
export const entrySchema = z.object({
 id:z.string().min(1),type:z.enum(["sale","expense"]),cents:finiteMoney.positive(),
 category:z.string().trim().min(1).max(100),pay:z.string().min(1).max(90),
 note:z.string().max(1000),createdAt:z.number().finite(),date:z.iso.date(),
 receipt:z.object({number:z.string(),status:z.enum(["draft","legacy"])}).nullable()
});
export const documentSchema: z.ZodType<Document> = z.object({
 version:z.literal(2),
 business:z.object({name:z.string().max(180),tin:z.string().max(60),phone:z.string().max(60),vatRegistered:z.boolean()}),
 locale:z.enum(["en","am","om","ti","so","aa","ar"]),theme:z.enum(["light","dark"]),
 entries:z.array(entrySchema).max(200000),
 customers:z.array(z.object({id:z.string(),name:z.string().max(180),phone:z.string().max(60),events:z.array(z.object({
  id:z.string(),type:z.enum(["credit","payment"]),cents:finiteMoney.positive(),note:z.string().max(1000),createdAt:z.number().finite()
 }))})).max(100000),
 nextDraft:z.number().int().positive(),updatedAt:z.number().finite()
}).superRefine((doc,ctx)=>{
 // Duplicate IDs would be silently collapsed by the keyed three-way merge.
 // Reject damaged or malicious imports before local storage or cloud upload.
 const entries=new Set<string>();
 const customers=new Set<string>();
 const receipts=new Set<string>();
 for(const [index,entry] of doc.entries.entries()){
  if(entries.has(entry.id))ctx.addIssue({code:"custom",path:["entries",index,"id"],message:"Duplicate transaction ID."});
  entries.add(entry.id);
  if(entry.receipt){
   if(receipts.has(entry.receipt.number))ctx.addIssue({code:"custom",path:["entries",index,"receipt"],message:"Duplicate receipt reference."});
   receipts.add(entry.receipt.number);
  }
 }
 for(const [index,customer] of doc.customers.entries()){
  if(customers.has(customer.id))ctx.addIssue({code:"custom",path:["customers",index,"id"],message:"Duplicate customer ID."});
  customers.add(customer.id);
  const events=new Set<string>();
  for(const [eventIndex,event] of customer.events.entries()){
   if(events.has(event.id))ctx.addIssue({code:"custom",path:["customers",index,"events",eventIndex,"id"],message:"Duplicate Dube event ID."});
   events.add(event.id);
  }
 }
});

export type SyncMeta = {
  key:"active"; accountId:string; revision:number; base:Document;
  lastSyncedAt:number; enabled:true; holdForReview?:boolean
};
export type RecoveryCopy = { id:string; at:number; reason:string; accountId:string; document:Document };
export const syncMetaSchema = z.object({
  key:z.literal("active"),accountId:z.string().uuid(),revision:z.number().int().positive(),
  base:documentSchema,lastSyncedAt:z.number().finite(),enabled:z.literal(true),
  holdForReview:z.boolean().optional()
});
class MezgebLocalDB extends Dexie {
 documents!: Table<{ key: string; value: Document }, string>;
 syncStates!: Table<SyncMeta,string>;
 recovery!: Table<RecoveryCopy,string>;
 constructor(){
   super("mezgeb_local_v2");
   this.version(1).stores({documents:"key"});
   this.version(2).stores({documents:"key",syncStates:"key",recovery:"id,at,accountId"});
 }
}
let database: MezgebLocalDB | null = null;
function db(){if(!database)database=new MezgebLocalDB();return database;}
export async function loadDocument():Promise<Document>{
  const record=await db().documents.get("main");
  if(!record)return initialDocument();
  const valid=documentSchema.safeParse(record.value);
  if(!valid.success)throw new Error("Saved ledger validation failed; data was not overwritten.");
  return valid.data;
}
export async function saveDocument(value:Document):Promise<void>{
  const safe=documentSchema.parse(value);
  await db().documents.put({key:"main",value:safe});
}
/**
 * Never allow a stale browser tab to overwrite another tab's persisted ledger.
 * The comparison and replacement are performed in one IndexedDB transaction.
 */
export async function saveDocumentIfUnchanged(value:Document, expected:Document):Promise<void>{
 const safe=documentSchema.parse(value);
 const baseline=documentSchema.parse(expected);
 const database=db();
 await database.transaction("rw",database.documents,async()=>{
  const current=await database.documents.get("main");
  if(!current || JSON.stringify(current.value)!==JSON.stringify(baseline)){
   throw new Error("Another Mezgeb tab updated this device's records. Your edits were NOT overwritten. Export a backup of this tab, then reload and review before continuing.");
  }
  await database.documents.put({key:"main",value:safe});
 });
}
export async function readSyncMeta():Promise<SyncMeta|null>{
 const value=await db().syncStates.get("active");
 if(!value)return null;
 const result=syncMetaSchema.safeParse(value);
 if(!result.success)throw Error("Saved sync metadata is invalid; automatic sync has been stopped to protect your data.");
 return result.data;
}
export async function storeSyncMeta(value:SyncMeta):Promise<void>{
 const next=syncMetaSchema.parse(value);
 const database=db();
 await database.transaction("rw",database.syncStates,async()=>{
  const existing=await database.syncStates.get("active");
  if(existing&&(existing.accountId!==next.accountId||existing.revision>next.revision)){
   throw new Error("Another tab changed the cloud sync checkpoint. Reload to reconcile safely.");
  }
  await database.syncStates.put(next);
 });
}
/**
 * Commit a downloaded cloud ledger and the matching cloud checkpoint atomically.
 * Without this transaction, closing the app between those two writes can make
 * a later sync misinterpret unsaved cloud records as local deletions.
 */
export async function commitCloudSnapshot(document:Document, checkpoint:SyncMeta, previous?:Document, reason="Before cloud restore"):Promise<void>{
 const current=documentSchema.parse(document);
 const state=syncMetaSchema.parse(checkpoint);
 const existing=previous?documentSchema.parse(previous):null;
 const database=db();
 await database.transaction("rw",database.documents,database.syncStates,database.recovery,async()=>{
  const stored=await database.documents.get("main");
  if(existing&&(!stored||JSON.stringify(stored.value)!==JSON.stringify(existing))){
   throw new Error("Another tab changed this device's ledger during recovery or sync. No records were replaced. Export this tab, then reload to reconcile.");
  }
  const priorCheckpoint=await database.syncStates.get("active");
  if(priorCheckpoint&&(priorCheckpoint.accountId!==state.accountId||
     priorCheckpoint.revision>state.revision)){
   throw new Error("Another tab advanced the cloud checkpoint. No records were replaced.");
  }
  if(existing){
   await database.recovery.put({
    id:globalThis.crypto.randomUUID(),at:Date.now(),reason:reason.slice(0,180),
    accountId:state.accountId,document:existing
   });
  }
  await database.documents.put({key:"main",value:current});
  await database.syncStates.put(state);
  const history=await database.recovery.where("accountId").equals(state.accountId).toArray();
  history.sort((a,b)=>b.at-a.at);
  if(history.length>20)await database.recovery.bulkDelete(history.slice(20).map(x=>x.id));
 });
}
export async function disconnectSyncAccount():Promise<void>{
 await db().syncStates.delete("active");
}
export async function createRecoveryCopy(document:Document, accountId:string, reason:string):Promise<void>{
 const record:RecoveryCopy={id:globalThis.crypto.randomUUID(),at:Date.now(),reason:reason.slice(0,180),
   accountId,document:documentSchema.parse(document)};
 await db().recovery.put(record);
 // Keep the latest 20 recoveries per account, never overwrite the only existing copy.
 const all=(await db().recovery.where("accountId").equals(accountId).toArray()).sort((a,b)=>b.at-a.at);
 const older=all.slice(20).map(x=>x.id);
 if(older.length)await db().recovery.bulkDelete(older);
}
export async function readRecoveryCopies(accountId:string):Promise<RecoveryCopy[]>{
 return (await db().recovery.where("accountId").equals(accountId).toArray()).sort((a,b)=>b.at-a.at);
}
export function id(){return globalThis.crypto.randomUUID();}
export function toCents(value:string|number):number{
 const raw=String(value).trim();
 if(!/^\d+(\.\d{1,2})?$/.test(raw))throw new Error("Enter a positive amount with up to two decimal places.");
 const [whole,frac=""]=raw.split(".");
 const cents=Number(whole)*100+Number((frac+"00").slice(0,2));
 if(!Number.isSafeInteger(cents)||cents<=0)throw new Error("Amount is too large or invalid.");
 return cents;
}
export function money(cents:number, locale:Locale="en"):string{
 const number=new Intl.NumberFormat(locale==="am"?"am-ET":"en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
 return number+" ETB";
}
export function todayISO(){const d=new Date();return localDate(d);}
export function localDate(d:Date){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
export function monthOf(date:string){return date.slice(0,7);}
export function vatCents(inclusiveGrossCents:number):number{return Math.round(inclusiveGrossCents*15/115);}
export function totals(entries:Entry[],month?:string,vatRegistered=true){
 const rows=month?entries.filter(e=>monthOf(e.date)===month):entries;
 const sales=rows.filter(e=>e.type==="sale").reduce((s,e)=>s+e.cents,0);
 const expenses=rows.filter(e=>e.type==="expense").reduce((s,e)=>s+e.cents,0);
 const outputVat=vatRegistered?rows.filter(e=>e.type==="sale").reduce((s,e)=>s+vatCents(e.cents),0):0;
 const inputVat=vatRegistered?rows.filter(e=>e.type==="expense"&&["Stock purchase","Utilities","ዕቃ ግዢ","መብራት/ውሃ"].includes(e.category)).reduce((s,e)=>s+vatCents(e.cents),0):0;
 return {sales,expenses,profit:sales-expenses,outputVat,inputVat,vatDue:Math.max(0,outputVat-inputVat),receipts:rows.filter(e=>Boolean(e.receipt)).length, count:rows.length};
}
export function creditBalance(customer:Customer):number{return customer.events.reduce((total,event)=>total+(event.type==="credit"?event.cents:-event.cents),0);}
export function outstanding(customers:Customer[]):number{return customers.reduce((s,c)=>s+Math.max(0,creditBalance(c)),0);}
export function csv(entries:Entry[]):string{
 const escaped=(value:string|number)=>'"'+String(value).replaceAll('"','""')+'"';
 return ["Date,Type,Category,Amount ETB,Method,Note,Receipt,Status",
 ...entries.map(e=>[e.date,e.type,e.category,(e.cents/100).toFixed(2),e.pay,e.note,e.receipt?.number??"",e.receipt?.status??""].map(escaped).join(","))].join("\r\n");
}
export function parseLegacy(raw:string):Document{
 const data:unknown=JSON.parse(raw);
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Invalid legacy backup.");
 const source=data as Record<string,unknown>;
 if(!Array.isArray(source.entries))throw Error("Legacy backup has no entries array.");
 const cleanText=(v:unknown,max=1000)=>typeof v==="string"?v.slice(0,max):"";
 const entries:Entry[]=source.entries.map((rawEntry:unknown,index:number)=>{
  if(!rawEntry||typeof rawEntry!=="object")throw Error("Invalid legacy transaction.");
  const e=rawEntry as Record<string,unknown>;
  const timestamp=Number(e.ts);
  if(!Number.isFinite(timestamp)||timestamp<=0)throw Error("Invalid legacy transaction date.");
  const date=localDate(new Date(timestamp));
  const cents=toCents(Number(e.amount).toFixed(2));
  const receipt=e.receipt&&typeof e.receipt==="object" ? {number:cleanText((e.receipt as Record<string,unknown>).sn,80)||"LEGACY-"+index,status:"legacy" as const}:null;
  return {id:cleanText(e.id,120)||id(),type:e.type==="expense"?"expense":"sale",cents,category:cleanText(e.cat,100)||"Uncategorized",pay:cleanText(e.pay,90)||"cash",note:cleanText(e.note),createdAt:timestamp,date,receipt};
 });
 const customers:Customer[]=Array.isArray(source.dube)?source.dube.map((rawCust:unknown)=>{
  if(!rawCust||typeof rawCust!=="object")throw Error("Invalid legacy customer.");
  const c=rawCust as Record<string,unknown>;
  const events:CreditEvent[]=Array.isArray(c.txns)?c.txns.map((rawEvent:unknown)=>{
   if(!rawEvent||typeof rawEvent!=="object")throw Error("Invalid Dube transaction.");
   const e=rawEvent as Record<string,unknown>;
   return {id:cleanText(e.id,120)||id(),type:e.type==="payment"?"payment":"credit",cents:toCents(Number(e.amount).toFixed(2)),note:cleanText(e.note),createdAt:Number(e.ts)||Date.now()};
  }):[];
  return {id:cleanText(c.id,120)||id(),name:cleanText(c.name,180),phone:cleanText(c.phone,60),events};
 }):[];
 const base=initialDocument();
 const locale=localeOptions.find(x=>x.code===source.lang)?.code??"en";
 const next={...base,business:{name:cleanText(source.biz,180),tin:cleanText(source.tin,60),phone:cleanText(source.phone,60),vatRegistered:source.vatReg!==false},locale,theme:source.theme==="dark"?"dark" as const:"light" as const,entries,customers,updatedAt:Date.now()};
 // Deliberately discard old account passwords and paid-plan flags; neither is a trusted server record.
 return documentSchema.parse(next);
}
export const copy = {
 en:{home:"Overview",ledger:"Ledger",receipts:"Receipts",reports:"Reports",dube:"Dube",settings:"Settings",plans:"Plans",welcome:"Welcome to Mezgeb",hello:"Your business, beautifully organized.",sale:"Record sale",expense:"Record expense",sales:"Sales",expenses:"Expenses",balance:"Net balance",recent:"Recent activity",outstanding:"Outstanding credit",addCustomer:"Add customer",customer:"Customer",amount:"Amount",save:"Save",cancel:"Cancel",newEntry:"New entry",date:"Date",category:"Category",method:"Payment method",note:"Note (optional)",print:"Print",download:"Download",empty:"Nothing here yet",search:"Search transactions",vat:"VAT position",draft:"Local draft",local:"On this device only",reportsTitle:"Business insights",import:"Import legacy data",backup:"Export backup",month:"Month"},
 am:{home:"ዋና ገጽ",ledger:"መዝገብ",receipts:"ደረሰኞች",reports:"ሪፖርቶች",dube:"ዱቤ",settings:"ቅንብሮች",plans:"ዕቅዶች",welcome:"እንኳን ወደ መዝገብ መጡ",hello:"የንግድዎ መዝገብ፣ በቀላሉ።",sale:"ሽያጭ መዝግብ",expense:"ወጪ መዝግብ",sales:"ሽያጭ",expenses:"ወጪዎች",balance:"ቀሪ ሂሳብ",recent:"የቅርብ ጊዜ እንቅስቃሴ",outstanding:"ያልተከፈለ ዱቤ",addCustomer:"ደንበኛ ጨምር",customer:"ደንበኛ",amount:"መጠን",save:"አስቀምጥ",cancel:"ይቅር",newEntry:"አዲስ መዝገብ",date:"ቀን",category:"ምድብ",method:"የክፍያ መንገድ",note:"ማስታወሻ (አማራጭ)",print:"አትም",download:"አውርድ",empty:"ገና መረጃ የለም",search:"መዝገብ ፈልግ",vat:"የቫት ሁኔታ",draft:"የአካባቢ ረቂቅ",local:"በዚህ መሣሪያ ብቻ",reportsTitle:"የንግድ ሪፖርቶች",import:"የቀድሞ መረጃ አስገባ",backup:"መጠባበቂያ አውርድ",month:"ወር"}
} as const;
export type CopyKey = keyof typeof copy.en;
export function label(locale:Locale,key:CopyKey){return (locale==="am"?copy.am:copy.en)[key];}
