"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, BadgeCheck, BookOpenText, CalendarDays, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, CircleAlert, CreditCard, Download, FileText, Filter, Landmark, LockKeyhole, Plus, Printer, Search, Settings2, ShieldCheck, Smartphone, Trash2, Upload, Users, Wallet, X } from "lucide-react";
import { useLedger } from "./providers";
import { Shell } from "@/components/shell";
import { CloudBackup } from "@/components/cloud-backup";
import { creditBalance, csv, documentSchema, expenseCategories, id, initialDocument, label, localeOptions, localDate, money, monthOf, outstanding, parseLegacy, payments, saleCategories, todayISO, toCents, totals, type CopyKey, type Customer, type Document, type Entry, type EntryType } from "@/lib/mezgeb";

function downloadFile(name:string, content:string, type:string){
 const blob=new Blob([content],{type});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=name;a.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function fmtDate(date:string){return new Date(date+"T12:00:00").toLocaleDateString("en-ET",{day:"numeric",month:"short",year:"numeric"});}
function moveMonth(value:string,delta:number){const [y,m]=value.split("-").map(Number);const d=new Date(y,m-1+delta,1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0")].join("-");}
function Blank({title="No records yet",subtitle="When you add records, they will show up here.",Icon=BookOpenText}:{title?:string;subtitle?:string;Icon?:typeof BookOpenText}){
 return <div className="blank"><span className="blank-icon"><Icon size={25}/></span><b>{title}</b><p>{subtitle}</p></div>;
}
function Heading({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action?:React.ReactNode}){
 return <div className="heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action&&<div className="heading-action">{action}</div>}</div>;
}
function Tile({title,value,Icon,kind="neutral",note}:{title:string;value:string;Icon:typeof Wallet;kind?:"neutral"|"positive"|"negative";note?:string}){
 return <div className={"tile "+kind}><div className="tile-top"><span>{title}</span><span className="tile-icon"><Icon size={19}/></span></div><strong className="numeric">{value}</strong>{note&&<small>{note}</small>}</div>;
}
function MonthNav({month,onChange}:{month:string;onChange:(m:string)=>void}){
 const shown=new Date(month+"-01T12:00:00").toLocaleDateString("en-ET",{month:"long",year:"numeric"});
 return <div className="month-nav"><button aria-label="Previous month" type="button" onClick={()=>onChange(moveMonth(month,-1))}><ChevronLeft size={18}/></button><span><CalendarDays size={15}/>{shown}</span><button aria-label="Next month" type="button" onClick={()=>onChange(moveMonth(month,1))}><ChevronRight size={18}/></button></div>;
}
function EntryList({entries,onSelect,locale}:{entries:Entry[];onSelect:(e:Entry)=>void;locale:Document["locale"]}){
 if(!entries.length)return <Blank title="No transactions yet" subtitle="Record a sale or expense to begin your ledger." Icon={Activity}/>;
 return <div className="entry-list">{entries.map(e=><button type="button" key={e.id} className="entry" onClick={()=>onSelect(e)}>
  <span className={"entry-mark "+(e.type==="sale"?"sale":"expense")}>{e.type==="sale"?<ArrowDownLeft size={20}/>:<ArrowUpRight size={20}/>}</span>
  <span className="entry-center"><strong>{e.category}</strong><small>{fmtDate(e.date)} · {e.pay}{e.note?" · "+e.note:""}</small>{e.receipt&&<em>{e.receipt.number} · {e.receipt.status==="legacy"?"Legacy record":"Local draft"}</em>}</span>
  <span className={"entry-amount "+(e.type==="sale"?"sale":"expense")}>{e.type==="sale"?"+":"−"}{money(e.cents,locale)}</span>
 </button>)}</div>;
}
function Onboard(){
 const {update}=useLedger();const [name,setName]=useState("");const [tin,setTin]=useState("");const [phone,setPhone]=useState("");const [vat,setVat]=useState(true);
 const submit=(e:FormEvent)=>{e.preventDefault();if(!name.trim())return;update(s=>({...s,business:{name:name.trim(),tin:tin.trim(),phone:phone.trim(),vatRegistered:vat}}));};
 return <main className="onboard-shell"><div className="onboard-brand"><span className="brand-symbol"><BookOpenText size={26}/></span> Mezgeb <span>መዝገብ</span></div><div className="onboard-grid"><section className="onboard-story"><span className="eyebrow light">BUILT FOR ETHIOPIAN BUSINESSES</span><h1>Every birr.<br/>Every day.<br/><span>Beautifully in order.</span></h1><p>One calm place to manage sales, expenses, receipts, and customer credit.</p><div className="onboard-story-foot">Your records are kept on this device until cloud sync is connected.</div></section><form className="onboard-card" onSubmit={submit}><span className="eyebrow">LET&apos;S GET STARTED</span><h2>Set up your business</h2><p>Tell Mezgeb a little about your shop or business.</p><label>Business name <span aria-hidden="true">*</span><input autoFocus required maxLength={180} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Addis Coffee House"/></label><div className="form-grid"><label>TIN (optional)<input maxLength={60} value={tin} onChange={e=>setTin(e.target.value)} placeholder="Taxpayer ID"/></label><label>Phone (optional)<input maxLength={60} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="09..."/></label></div><label className="check-row"><input type="checkbox" checked={vat} onChange={e=>setVat(e.target.checked)}/><span>VAT registered <small>Use 15% VAT-inclusive estimates where appropriate</small></span></label><button className="btn primary full" type="submit">Open my ledger <ArrowRight size={18}/></button><p className="small-print"><ShieldCheck size={14}/> This is a local-first preview, not an official tax filing system.</p></form></div></main>;
}

function EntryEditor({type,entry,onClose}:{type:EntryType;entry:Entry|null;onClose:()=>void}){
 const {doc,update}=useLedger();
 const [kind,setKind]=useState<EntryType>(entry?.type||type);
 const [amount,setAmount]=useState(entry?(entry.cents/100).toFixed(2):"");
 const [category,setCategory]=useState(entry?.category|| (type==="sale"?saleCategories[0]:expenseCategories[0]));
 const [pay,setPay]=useState(entry?.pay||"Cash");
 const [note,setNote]=useState(entry?.note||"");
 const [date,setDate]=useState(entry?.date||todayISO());
 const [receipt,setReceipt]=useState(Boolean(entry?.receipt));
 const [error,setError]=useState("");
 const max=30;
 const count=doc.entries.filter(e=>e.receipt&&e.receipt.status==="draft"&&monthOf(e.date)===monthOf(date)).length;
 useEffect(()=>{if(!entry)setCategory(kind==="sale"?saleCategories[0]:expenseCategories[0]);},[kind,entry]);
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose();};document.addEventListener("keydown",handler);return ()=>document.removeEventListener("keydown",handler);},[onClose]);
 const save=(event:FormEvent)=>{
  event.preventDefault();
  try{
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+"T12:00:00").valueOf()))throw Error("Choose a valid date.");
   const cents=toCents(amount);
   if(kind==="expense"&&receipt)throw Error("Draft receipts are only available for sales.");
   if(entry?.receipt?.status==="legacy")throw Error("Legacy receipts are read-only for traceability.");
   if(kind==="sale"&&receipt&&!entry?.receipt&&count>=max)throw Error("The 30 local-draft monthly limit has been reached. Paid plans are not yet connected.");
   const now=Date.now();
   update(s=>{
    let receiptRecord=entry?.receipt||null;let nextDraft=s.nextDraft;
    if(kind==="sale"&&receipt&&!receiptRecord){receiptRecord={number:"DRAFT-"+String(nextDraft++).padStart(6,"0"),status:"draft"};}
    if(!receipt)receiptRecord=null;
    const record:Entry={id:entry?.id||id(),type:kind,cents,category:category.trim(),pay,note:note.trim(),date,createdAt:entry?.createdAt||now,receipt:receiptRecord};
    return {...s,nextDraft,entries:entry?s.entries.map(e=>e.id===entry.id?record:e):[record,...s.entries]};
   });
   onClose();
  }catch(e){setError(e instanceof Error?e.message:"Cannot save this entry.");}
 };
 const remove=()=>{if(!entry)return;if(entry.receipt){setError("Receipt-related transactions must be retained for traceability. Contact your accountant about reversals.");return;}if(!window.confirm("Delete this transaction?"))return;update(s=>({...s,entries:s.entries.filter(e=>e.id!==entry.id)}));onClose();};
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label={entry?"Edit transaction":"Record transaction"}><div className="modal-header"><div><span className="eyebrow">DAILY LEDGER</span><h2>{entry?"Edit transaction":"New transaction"}</h2></div><button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><X size={21}/></button></div><form onSubmit={save} className="modal-content">
   <div className="segmented"><button type="button" disabled={Boolean(entry?.receipt)} className={kind==="sale"?"selected":""} onClick={()=>{setKind("sale");setReceipt(false);}}>Sale</button><button type="button" disabled={Boolean(entry?.receipt)} className={kind==="expense"?"selected":""} onClick={()=>{setKind("expense");setReceipt(false);}}>Expense</button></div>
   <label className="big-amount">Amount (ETB)<div><span>Br</span><input required autoFocus inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" aria-label="Amount in ETB"/></div></label>
   <div className="form-grid"><label>Date<input required type="date" value={date} onChange={e=>setDate(e.target.value)} /></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{(kind==="sale"?saleCategories:expenseCategories).concat(entry&&!((kind==="sale"?saleCategories:expenseCategories).includes(entry.category))?[entry.category]:[]).map(c=><option key={c}>{c}</option>)}</select></label></div>
   <label>Payment method<select value={pay} onChange={e=>setPay(e.target.value)}>{payments.concat(entry&&!payments.includes(entry.pay)?[entry.pay]:[]).map(p=><option key={p}>{p}</option>)}</select></label>
   <label>Note (optional)<textarea rows={2} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="What was this for?"/></label>
   {kind==="sale"&&<label className="check-row"><input type="checkbox" checked={receipt} disabled={Boolean(entry?.receipt?.status==="legacy")} onChange={e=>setReceipt(e.target.checked)}/><span>Prepare a draft receipt <small>Not an official tax document · {count}/{max} local drafts this month</small></span></label>}
   {entry?.receipt?.status==="legacy"&&<p className="notice">This imported receipt is preserved as a legacy record and cannot be edited.</p>}
   {error&&<p role="alert" className="form-error">{error}</p>}
   <div className="form-actions">{entry&&!entry.receipt&&<button className="btn danger ghost" type="button" onClick={remove}><Trash2 size={17}/> Delete</button>}<button className="btn subtle" type="button" onClick={onClose}>Cancel</button><button className="btn primary" disabled={Boolean(entry?.receipt?.status==="legacy")} type="submit"><Check size={18}/> Save transaction</button></div>
  </form></section></div>;
}

function Receipts({onView}:{onView:(e:Entry)=>void}){
 const {doc}=useLedger();const receipts=doc.entries.filter(e=>e.receipt).sort((a,b)=>b.createdAt-a.createdAt);
 return <><Heading eyebrow="RECORDS & DOCUMENTS" title="Receipts" subtitle="Review legacy receipts and local drafts before official server issuance."/><div className="notice"><CircleAlert size={17}/> Receipts created here are drafts only. Official sequential numbering and fiscal compliance require verified backend setup.</div><div className="surface">{receipts.length?<div className="receipt-grid">{receipts.map(e=><button key={e.id} className="receipt-card" onClick={()=>onView(e)}><div className="receipt-icon"><FileText size={22}/></div><div><strong>{e.receipt?.number}</strong><span>{e.category} · {fmtDate(e.date)}</span><small>{e.receipt?.status==="legacy"?"Imported legacy receipt":"Unissued local draft"}</small></div><b>{money(e.cents,doc.locale)}</b></button>)}</div>:<Blank title="No receipts yet" subtitle="Choose 'Prepare a draft receipt' while recording a sale." Icon={FileText}/>}</div></>;
}
function ReceiptDetail({entry,onClose}:{entry:Entry;onClose:()=>void}){
 const {doc}=useLedger();
 const tax=doc.business.vatRegistered?Math.round(entry.cents*15/115):0;
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal receipt-modal" role="dialog" aria-modal="true" aria-label="Receipt preview"><div className="modal-header no-print"><h2>Receipt details</h2><button className="icon-btn" onClick={onClose} aria-label="Close receipt"><X size={20}/></button></div><div className="receipt-paper print-area"><header><div className="receipt-logo">Mezgeb <span>መዝገብ</span></div><small>{doc.business.name}</small><small>{doc.business.tin?"TIN: "+doc.business.tin:""} {doc.business.phone}</small></header><div className="draft-stamp">{entry.receipt?.status==="legacy"?"LEGACY RECORD — UNVERIFIED":"LOCAL DRAFT — NOT AN OFFICIAL TAX RECEIPT"}</div><div className="receipt-line"><span>Reference</span><strong>{entry.receipt?.number}</strong></div><div className="receipt-line"><span>Date</span><strong>{fmtDate(entry.date)}</strong></div><div className="receipt-line"><span>Category</span><strong>{entry.category}</strong></div><div className="receipt-line"><span>Payment</span><strong>{entry.pay}</strong></div><div className="receipt-line"><span>Amount before estimated VAT</span><strong>{money(entry.cents-tax)}</strong></div><div className="receipt-line"><span>Estimated VAT (15%)</span><strong>{money(tax)}</strong></div><div className="receipt-total"><span>Total</span><strong>{money(entry.cents)}</strong></div><footer>Prepared with Mezgeb መዝገብ<br/>For internal recordkeeping only</footer></div><div className="form-actions no-print"><button className="btn subtle" onClick={onClose}>Close</button><button className="btn primary" onClick={()=>window.print()}><Printer size={17}/> Print draft</button></div></section></div>;
}

function Dube(){
 const {doc,update}=useLedger();
 const [add,setAdd]=useState(false);const [name,setName]=useState("");const [phone,setPhone]=useState("");
 const [selected,setSelected]=useState<string|null>(null);const [kind,setKind]=useState<"credit"|"payment">("credit");
 const [amount,setAmount]=useState("");const [note,setNote]=useState("");const [error,setError]=useState("");
 const customers=[...doc.customers].sort((a,b)=>creditBalance(b)-creditBalance(a));
 const customer=doc.customers.find(c=>c.id===selected);
 const addOne=(event:FormEvent)=>{event.preventDefault();if(!name.trim())return;update(s=>({...s,customers:[{id:id(),name:name.trim(),phone:phone.trim(),events:[]},...s.customers]}));setName("");setPhone("");setAdd(false);};
 const post=(event:FormEvent)=>{
  event.preventDefault();if(!customer)return;
  try{
   const cents=toCents(amount);
   if(kind==="payment"&&cents>creditBalance(customer))throw Error("Payment cannot exceed the amount owed.");
   update(s=>({...s,customers:s.customers.map(c=>c.id!==customer.id?c:{...c,events:[{id:id(),type:kind,cents,note:note.trim(),createdAt:Date.now()},...c.events]})}));
   setAmount("");setNote("");setError("");
  }catch(e){setError(e instanceof Error?e.message:"Invalid amount.");}
 };
 return <><Heading eyebrow="CUSTOMER CREDIT" title="Dube · ዱቤ" subtitle="Know exactly who owes what, without losing track." action={<button className="btn primary" onClick={()=>setAdd(true)}><Plus size={17}/> Add customer</button>}/><div className="stats two"><Tile title="Total outstanding" value={money(outstanding(customers),doc.locale)} Icon={Wallet}/><Tile title="Active customers" value={String(customers.filter(c=>creditBalance(c)>0).length)} Icon={Users}/></div><div className="surface"><div className="surface-title"><h2>Customers</h2><span>{customers.length} total</span></div>{customers.length?<div className="customer-list">{customers.map(c=><button key={c.id} className="customer-row" onClick={()=>setSelected(c.id)}><span className="customer-avatar">{c.name[0]?.toUpperCase()||"?"}</span><span className="customer-name"><strong>{c.name}</strong><small>{c.phone||"No phone"} · {c.events.length} entries</small></span><span className="customer-owed">{creditBalance(c)>0?money(creditBalance(c),doc.locale):"Settled"}<ChevronRight size={18}/></span></button>)}</div>:<Blank title="Your credit book starts here" subtitle="Add a customer, then record credit and repayments." Icon={Users}/>}</div>
 {add&&<div className="modal-backdrop"><form className="modal modal-content" onSubmit={addOne} role="dialog" aria-modal="true" aria-label="Add customer"><div className="modal-header"><h2>Add customer</h2><button className="icon-btn" type="button" onClick={()=>setAdd(false)} aria-label="Close"><X/></button></div><label>Name<input autoFocus required value={name} maxLength={180} onChange={e=>setName(e.target.value)}/></label><label>Phone (optional)<input value={phone} maxLength={60} onChange={e=>setPhone(e.target.value)}/></label><button className="btn primary full" type="submit">Save customer</button></form></div>}
 {customer&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Customer credit details"><div className="modal-header"><div><span className="eyebrow">DUBE CREDIT BOOK</span><h2>{customer.name}</h2><p>{customer.phone}</p></div><button className="icon-btn" onClick={()=>{setSelected(null);setError("");}} aria-label="Close"><X/></button></div><div className="modal-content"><div className="balance-band"><span>Balance owed</span><strong>{money(creditBalance(customer),doc.locale)}</strong></div><form onSubmit={post}><div className="segmented"><button type="button" className={kind==="credit"?"selected":""} onClick={()=>setKind("credit")}>Add credit</button><button type="button" className={kind==="payment"?"selected":""} onClick={()=>setKind("payment")}>Record payment</button></div><label>Amount (ETB)<input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label><label>Note (optional)<input value={note} onChange={e=>setNote(e.target.value)} maxLength={1000}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn primary full" type="submit">Save {kind}</button></form><h3>History</h3>{customer.events.length?<div className="credit-events">{customer.events.map(e=><div key={e.id}><span>{e.type==="credit"?"Credit":"Payment"} <small>{new Date(e.createdAt).toLocaleDateString("en-ET")}{e.note?" · "+e.note:""}</small></span><strong className={e.type==="credit"?"negative":"positive"}>{e.type==="credit"?"+":"−"}{money(e.cents)}</strong></div>)}</div>:<p className="muted">No credit entries yet.</p>}</div></section></div>}
 </>;
}

function Reports(){
 const {doc}=useLedger();const [month,setMonth]=useState(monthOf(todayISO()));
 const summary=totals(doc.entries,month,doc.business.vatRegistered);const rows=doc.entries.filter(e=>monthOf(e.date)===month);
 const daily=Array.from(rows.reduce((map,e)=>{const day=e.date.slice(8);const row=map.get(day)||{sale:0,expense:0};row[e.type]+=e.cents;map.set(day,row);return map;},new Map<string,{sale:number;expense:number}>())).sort(([a],[b])=>a.localeCompare(b));
 const max=Math.max(1,...daily.flatMap(([,e])=>[e.sale,e.expense]));
 return <><Heading eyebrow="YOUR NUMBERS" title="Reports & insights" subtitle="A clear picture of how your business is doing." action={<button className="btn subtle" onClick={()=>downloadFile("mezgeb-ledger-"+month+".csv",csv(rows),"text/csv;charset=utf-8")}><Download size={17}/> Export CSV</button>}/><MonthNav month={month} onChange={setMonth}/><div className="stats three"><Tile title="Gross sales" value={money(summary.sales,doc.locale)} Icon={ArrowDownLeft} kind="positive"/><Tile title="Expenses" value={money(summary.expenses,doc.locale)} Icon={ArrowUpRight} kind="negative"/><Tile title="Net result" value={money(summary.profit,doc.locale)} Icon={Wallet}/></div><div className="report-grid"><div className="surface"><div className="surface-title"><h2>Sales & expenses</h2><span>Daily</span></div>{daily.length?<div className="chart">{daily.map(([day,e])=><div key={day} className="chart-row"><small>{day}</small><div className="chart-track"><span className="sale-bar" style={{width:(100*e.sale/max)+"%"}}/><span className="expense-bar" style={{width:(100*e.expense/max)+"%"}}/></div><strong>{money(e.sale-e.expense)}</strong></div>)}</div>:<Blank title="No activity in this month" Icon={ChartNoAxesCombined}/>}</div><div className="surface"><div className="surface-title"><h2>VAT overview</h2><span>Estimated · 15%</span></div>{doc.business.vatRegistered?<div className="vat-list"><div><span>Output VAT</span><strong>{money(summary.outputVat)}</strong></div><div><span>Estimated input VAT*</span><strong>− {money(summary.inputVat)}</strong></div><div className="vat-total"><span>Estimated VAT due</span><strong>{money(summary.vatDue)}</strong></div><small>*Based on stock and utilities categories; eligibility and documentation require accountant review. Not a tax filing.</small></div>:<div className="notice">VAT reporting is disabled for this business.</div>}</div></div></>;
}

function Settings(){
 const {doc,update,replace}=useLedger();
 const [name,setName]=useState(doc.business.name);const [tin,setTin]=useState(doc.business.tin);const [phone,setPhone]=useState(doc.business.phone);const [vat,setVat]=useState(doc.business.vatRegistered);
 const [message,setMessage]=useState("");const fileRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{setName(doc.business.name);setTin(doc.business.tin);setPhone(doc.business.phone);setVat(doc.business.vatRegistered);},[doc.business]);
 const save=(e:FormEvent)=>{e.preventDefault();if(!name.trim())return;update(s=>({...s,business:{name:name.trim(),tin:tin.trim(),phone:phone.trim(),vatRegistered:vat}}));setMessage("Business details saved on this device.");};
 const importFile=async(file:File|undefined)=>{
  if(!file)return;
  try{
   if(file.size>25_000_000)throw Error("File is too large (25 MB maximum).");
   const raw=await file.text();const json=JSON.parse(raw);
   const imported=json?.version===2?documentSchema.parse(json):parseLegacy(raw);
   if(!window.confirm("Import "+imported.entries.length+" ledger entries and "+imported.customers.length+" customers? This replaces your current local ledger. Download a backup first."))return;
   replace(imported);setMessage("Import successful. Original file was not modified.");
  }catch(e){setMessage(e instanceof Error?"Import failed: "+e.message:"Import failed.");}
  finally{if(fileRef.current)fileRef.current.value="";}
 };
 const importOnDevice=()=>{const old=localStorage.getItem("mezgeb_v1");if(!old){setMessage("No legacy mezgeb_v1 data found in this browser. Use a JSON export from the old app.");return;}try{const imported=parseLegacy(old);if(window.confirm("Import "+imported.entries.length+" legacy transactions? Download a backup of the current ledger first.")){replace(imported);setMessage("Legacy data imported. The old copy is unchanged.");}}catch(e){setMessage(e instanceof Error?e.message:"Invalid legacy data.");}};
 return <><Heading eyebrow="PREFERENCES & BUSINESS" title="Settings" subtitle="Personalize Mezgeb and keep control of your information."/><div className="settings-grid"><section className="surface settings-section"><div className="surface-title"><h2>Business profile</h2><Settings2 size={18}/></div><form onSubmit={save}><label>Business name<input required maxLength={180} value={name} onChange={e=>setName(e.target.value)}/></label><div className="form-grid"><label>TIN<input maxLength={60} value={tin} onChange={e=>setTin(e.target.value)}/></label><label>Phone<input maxLength={60} value={phone} onChange={e=>setPhone(e.target.value)}/></label></div><label className="check-row"><input type="checkbox" checked={vat} onChange={e=>setVat(e.target.checked)}/><span>VAT registered <small>Enable VAT-inclusive reporting estimates</small></span></label><button className="btn primary" type="submit">Save business details</button></form></section>
 <section className="surface settings-section"><div className="surface-title"><h2>Experience</h2><Smartphone size={18}/></div><label>Language<select value={doc.locale} onChange={e=>update(s=>({...s,locale:e.target.value as Document["locale"]}))}>{localeOptions.map(l=><option value={l.code} key={l.code}>{l.label}</option>)}</select></label><p className="muted">English and Amharic cover the current main workflow. Other original languages are selectable with English fallback while the source dictionaries are migrated.</p><label>Appearance<select value={doc.theme} onChange={e=>update(s=>({...s,theme:e.target.value as Document["theme"]}))}><option value="light">Light</option><option value="dark">Dark</option></select></label></section>
 <section className="surface settings-section"><div className="surface-title"><h2>Data & backup</h2><Download size={18}/></div><p className="muted">Your ledger saves first on this device. Export JSON regularly; optional manual cloud backup is available below.</p><button className="btn subtle full" onClick={()=>downloadFile("mezgeb-backup-"+todayISO()+".json",JSON.stringify(doc,null,2),"application/json")}><Download size={18}/> Download JSON backup</button><input aria-label="Select legacy JSON or backup file" type="file" ref={fileRef} accept=".json,application/json" onChange={e=>void importFile(e.target.files?.[0])}/><button className="btn subtle full" onClick={importOnDevice}><Upload size={18}/> Import old Mezgeb from this browser</button><p className="muted">You can also select an exported legacy JSON file above. Imports require confirmation.</p></section>
 <section className="surface settings-section"><div className="surface-title"><h2>Account & cloud</h2><LockKeyhole size={18}/></div><div className="integration-row"><span><ShieldCheck size={18}/> Supabase authentication</span><b>See cloud status below</b></div><div className="integration-row"><span><Landmark size={18}/> Cloud synchronization</span><b>Not connected</b></div><div className="integration-row"><span><CreditCard size={18}/> Chapa paid checkout</span><b>Not connected</b></div><p className="notice">Manual cloud backup is available after sign-in. Automatic synchronization, certified receipts, and live Chapa payment are not enabled yet.</p></section><CloudBackup /></div>{message&&<p role="status" className="toast">{message}</p>}</>;
}

function Plans(){
 return <><Heading eyebrow="MEZGEB PLANS" title="Grow with Mezgeb" subtitle="Designed for daily business records, from your first sale to your busiest month."/><div className="plan-grid">{[
  {name:"Free",price:"0 ETB",tag:"Available now",features:["Daily sales and expenses","Up to 30 local draft receipts per month","Dube credit tracking in local preview","Manual JSON backup"]},
  {name:"Standard",price:"Coming soon",tag:"Backend connection required",features:["Verified subscription entitlement","Unlimited receipts (subject to issuance rules)","Advanced reporting","Account cloud access"]},
  {name:"Premium",price:"Coming soon",tag:"Backend connection required",features:["Everything in Standard","Premium Dube tools","Priority support","Multi-device features"]}
 ].map((plan,i)=><article className={"plan-card "+(i===1?"featured":"")} key={plan.name}><span className="eyebrow">{plan.tag}</span><h2>{plan.name}</h2><div className="plan-price">{plan.price}</div><ul>{plan.features.map(f=><li key={f}><Check size={17}/>{f}</li>)}</ul><button className={"btn full "+(i===0?"primary":"subtle")} disabled={i!==0}>{i===0?"Current local preview":"Payments not connected"}</button></article>)}</div><div className="notice"><CircleAlert size={17}/> Pricing, paid entitlements, and checkout will be enabled only after secure server verification and a configured Chapa integration.</div></>;
}

export function Workspace({section}:{section:string}){
 const {doc,ready,error}=useLedger();
 const [newType,setNewType]=useState<EntryType|null>(null);
 const [editing,setEditing]=useState<Entry|null>(null);
 const [receiptView,setReceiptView]=useState<Entry|null>(null);
 const [month,setMonth]=useState(monthOf(todayISO()));
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState<"all"|EntryType>("all");
 const summary=useMemo(()=>totals(doc.entries,month,doc.business.vatRegistered),[doc.entries,month,doc.business.vatRegistered]);
 const current=useMemo(()=>doc.entries.filter(e=>monthOf(e.date)===month&& (filter==="all"||e.type===filter)&&([e.note,e.category,e.pay].join(" ").toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>b.createdAt-a.createdAt),[doc.entries,month,filter,search]);
 const recent=useMemo(()=>[...doc.entries].sort((a,b)=>b.createdAt-a.createdAt).slice(0,6),[doc.entries]);
 if(error&&!ready)return <div className="fatal"><h1>Could not open your local data</h1><p>{error}</p><p>Do not clear browser storage. Your existing data has not been overwritten.</p></div>;
 if(!ready)return <div className="loading-shell"><span className="brand-symbol"><BookOpenText/></span><h1>Mezgeb መዝገብ</h1><p>Opening your ledger…</p></div>;
 if(!doc.business.name)return <Onboard/>;
 const l=(key:CopyKey)=>label(doc.locale,key);
 return <Shell onNew={()=>setNewType("sale")}>
  {section==="home"&&<>
   <Heading eyebrow="YOUR BUSINESS AT A GLANCE" title={"Good to see you."} subtitle={doc.business.name+" · "+l("hello")} action={<div className="action-pair"><button className="btn primary" onClick={()=>setNewType("sale")}><Plus size={18}/>{l("sale")}</button><button className="btn subtle" onClick={()=>setNewType("expense")}><ArrowUpRight size={18}/>{l("expense")}</button></div>}/>
   <div className="welcome-band"><span className="welcome-spark">✦</span><div><strong>Every transaction tells your business story.</strong><p>Stay organized today. Make better decisions tomorrow.</p></div><span className="band-doodle">መዝገብ</span></div>
   <MonthNav month={month} onChange={setMonth}/>
   <div className="stats four"><Tile title={l("sales")} value={money(summary.sales,doc.locale)} Icon={ArrowDownLeft} kind="positive" note={summary.count+" total transactions"}/><Tile title={l("expenses")} value={money(summary.expenses,doc.locale)} Icon={ArrowUpRight} kind="negative"/><Tile title={l("balance")} value={money(summary.profit,doc.locale)} Icon={Wallet}/><Tile title={l("outstanding")} value={money(outstanding(doc.customers),doc.locale)} Icon={Users}/></div>
   <div className="home-grid"><section className="surface"><div className="surface-title"><h2>{l("recent")}</h2><a href="/ledger">View all <ArrowRight size={15}/></a></div><EntryList entries={recent} onSelect={setEditing} locale={doc.locale}/></section><section className="surface quick-panel"><div className="surface-title"><h2>Quick actions</h2></div><button onClick={()=>setNewType("sale")}><span className="quick-icon sale"><Plus size={20}/></span><span><b>New sale</b><small>Capture revenue in seconds</small></span><ChevronRight size={17}/></button><button onClick={()=>setNewType("expense")}><span className="quick-icon expense"><ArrowUpRight size={20}/></span><span><b>New expense</b><small>Track where money goes</small></span><ChevronRight size={17}/></button><a href="/dube"><span className="quick-icon credit"><Users size={20}/></span><span><b>Dube book</b><small>Manage customer balances</small></span><ChevronRight size={17}/></a><a href="/reports"><span className="quick-icon report"><ChartNoAxesCombined size={20}/></span><span><b>Reports</b><small>See the bigger picture</small></span><ChevronRight size={17}/></a></section></div>
  </>}
  {section==="ledger"&&<><Heading eyebrow="ALL YOUR TRANSACTIONS" title={l("ledger")} subtitle="A clear, searchable record of your business activity." action={<div className="action-pair"><button className="btn primary" onClick={()=>setNewType("sale")}><Plus size={17}/> Sale</button><button className="btn subtle" onClick={()=>setNewType("expense")}><Plus size={17}/> Expense</button></div>}/><MonthNav month={month} onChange={setMonth}/><div className="stats three"><Tile title={l("sales")} value={money(summary.sales,doc.locale)} Icon={ArrowDownLeft} kind="positive"/><Tile title={l("expenses")} value={money(summary.expenses,doc.locale)} Icon={ArrowUpRight} kind="negative"/><Tile title={l("balance")} value={money(summary.profit,doc.locale)} Icon={Wallet}/></div><div className="surface"><div className="surface-title"><h2>Transactions</h2><span>{current.length} results</span></div><div className="list-tools"><label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={l("search")} aria-label="Search ledger"/></label><div className="filter-group"><Filter size={17}/><select aria-label="Filter transaction type" value={filter} onChange={e=>setFilter(e.target.value as "all"|EntryType)}><option value="all">All types</option><option value="sale">Sales</option><option value="expense">Expenses</option></select></div></div><EntryList entries={current} onSelect={setEditing} locale={doc.locale}/></div></>}
  {section==="receipts"&&<Receipts onView={setReceiptView}/>}
  {section==="reports"&&<Reports/>}
  {section==="dube"&&<Dube/>}
  {section==="settings"&&<Settings/>}
  {section==="plans"&&<Plans/>}
  {newType&&<EntryEditor key={newType+"-new"} type={newType} entry={null} onClose={()=>setNewType(null)}/>}
  {editing&&<EntryEditor key={editing.id} type={editing.type} entry={editing} onClose={()=>setEditing(null)}/>}
  {receiptView&&<ReceiptDetail entry={receiptView} onClose={()=>setReceiptView(null)}/>}
 </Shell>;
}
