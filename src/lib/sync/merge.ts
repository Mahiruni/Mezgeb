import type { Business, CreditEvent, Customer, Document, Entry } from "../mezgeb";
import { creditBalance, documentSchema } from "../mezgeb";

export type Conflict = { section: "business" | "ledger" | "dube" | "receipt" | "balance"; key: string; reason: string };
export type MergeResult = { ok: true; document: Document } | { ok: false; conflicts: Conflict[] };

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
type Change<T> = { value: T | undefined; conflict: boolean };

function mergeValue<T>(base: T | undefined, local: T | undefined, remote: T | undefined): Change<T> {
  if (equal(local, remote)) return { value: local, conflict: false };
  if (equal(local, base)) return { value: remote, conflict: false };
  if (equal(remote, base)) return { value: local, conflict: false };
  return { value: undefined, conflict: true };
}
function keyed<T extends { id: string }>(items: T[]): Map<string,T> { return new Map(items.map(x=>[x.id,x])); }

function mergeRecordCollection<T extends {id:string}>(
  base: T[], local: T[], remote: T[],
  section: Conflict["section"], conflicts: Conflict[]
): T[] {
  const bases=keyed(base), left=keyed(local), right=keyed(remote);
  const ids=new Set([...bases.keys(),...left.keys(),...right.keys()]);
  const merged:T[]=[];
  for(const id of ids){
    // Credit history is append-only. A deletion must never disappear silently,
    // even if the remote record has not changed yet.
    if(section==="dube" && bases.has(id) && (!left.has(id)||!right.has(id))){
      conflicts.push({section,key:id,reason:"A historical credit transaction was removed. Review financial history before continuing."});
      continue;
    }
    const result=mergeValue(bases.get(id),left.get(id),right.get(id));
    if(result.conflict){
      conflicts.push({section,key:id,reason:"This record changed differently on both devices."});
    }else if(result.value!==undefined){ merged.push(result.value); }
  }
  return merged;
}

function mergeCustomer(base: Customer | undefined, local: Customer | undefined, remote: Customer | undefined, conflicts:Conflict[]):Customer|undefined{
 if(!base){
   if(!local)return remote;
   if(!remote)return local;
   // Same ID added on both devices, do not silently combine different identities.
   if(local.name!==remote.name||local.phone!==remote.phone){
     conflicts.push({section:"dube",key:local.id,reason:"A customer ID was added differently on two devices."});
     return undefined;
   }
   const events=mergeRecordCollection<CreditEvent>([],local.events,remote.events,"dube",conflicts);
   return {...local,events:events.sort((a,b)=>b.createdAt-a.createdAt)};
 }
 if(!local||!remote){
   if(base.events.length || (local||remote)?.events.length){
     conflicts.push({section:"dube",key:base.id,reason:"A customer with financial history was removed on one device. Customer credit records cannot be silently deleted."});
   }else{
     const deleted=local===undefined?remote:local;
     if(deleted&&!equal(deleted,base)){
       conflicts.push({section:"dube",key:base.id,reason:"A customer was deleted while another device changed it."});
     }
   }
   return undefined;
 }
 const name=mergeValue(base.name,local.name,remote.name);
 const phone=mergeValue(base.phone,local.phone,remote.phone);
 if(name.conflict||phone.conflict){
   conflicts.push({section:"dube",key:base.id,reason:"Customer contact fields conflict."});
 }
 const events=mergeRecordCollection<CreditEvent>(base.events,local.events,remote.events,"dube",conflicts);
 return {...local,name:name.value??local.name,phone:phone.value??local.phone,events:events.sort((a,b)=>b.createdAt-a.createdAt)};
}
export function comparable(doc:Document){
 return {business:doc.business,entries:[...doc.entries].sort((a,b)=>a.id.localeCompare(b.id)),customers:[...doc.customers]
 .map(c=>({...c,events:[...c.events].sort((a,b)=>a.id.localeCompare(b.id))})).sort((a,b)=>a.id.localeCompare(b.id))};
}
export function isSameLedger(a:Document,b:Document){return equal(comparable(a),comparable(b));}
export function mergeLedgers(base:Document, local:Document, remote:Document):MergeResult{
 const conflicts:Conflict[]=[];
 const business={} as Business;
 for(const prop of ["name","tin","phone","vatRegistered"] as const){
  const result=mergeValue(base.business[prop],local.business[prop],remote.business[prop]);
  if(result.conflict) conflicts.push({section:"business",key:prop,reason:"Business profile changed on two devices."});
  (business as unknown as Record<string,unknown>)[prop]=result.conflict?local.business[prop]:result.value;
 }
 const entries=mergeRecordCollection<Entry>(base.entries,local.entries,remote.entries,"ledger",conflicts)
   .sort((a,b)=>b.createdAt-a.createdAt);
 const baseCust=keyed(base.customers),localCust=keyed(local.customers),remoteCust=keyed(remote.customers);
 const customers:Customer[]=[];
 for(const id of new Set([...baseCust.keys(),...localCust.keys(),...remoteCust.keys()])){
   const merged=mergeCustomer(baseCust.get(id),localCust.get(id),remoteCust.get(id),conflicts);
   if(merged) customers.push(merged);
 }
 customers.sort((a,b)=>a.name.localeCompare(b.name));

 // Draft receipt numbers may repeat on two offline devices. Never silently
 // treat duplicate numbered drafts as two unique documents.
 const seen=new Map<string,string>();
 for(const e of entries){
  if(!e.receipt)continue;
  const first=seen.get(e.receipt.number);
  if(first&&first!==e.id){
   conflicts.push({section:"receipt",key:e.receipt.number,reason:"Duplicate draft or legacy receipt reference across distinct transactions."});
  }else{seen.set(e.receipt.number,e.id);}
 }
 // Simultaneous independent repayments can overpay the same customer.
 for(const customer of customers){
  if(creditBalance(customer)<0){
   conflicts.push({section:"balance",key:customer.id,reason:"Merged repayments exceed this customer's outstanding credit."});
  }
 }
 const merged:Document={
  version:2,business,entries,customers,
  locale:local.locale,theme:local.theme, // UI preference stays on this device
  nextDraft:Math.max(local.nextDraft,remote.nextDraft,base.nextDraft),
  updatedAt:Math.max(local.updatedAt,remote.updatedAt,Date.now())
 };
 if(!documentSchema.safeParse(merged).success){
   conflicts.push({section:"ledger",key:"schema",reason:"Merged document did not pass financial schema validation."});
 }
 return conflicts.length?{ok:false,conflicts}:{ok:true,document:merged};
}
