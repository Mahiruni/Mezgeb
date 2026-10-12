import {describe,expect,it} from "vitest";
import {initialDocument,type Customer,type Document,type Entry} from "../src/lib/mezgeb";
import {isSameLedger,mergeLedgers} from "../src/lib/sync/merge";

const make=():Document=>({...initialDocument(),business:{name:"Mezgeb Test Shop",tin:"",phone:"",vatRegistered:false}});
const entry=(id:string,cents=1200):Entry=>({id,type:"sale",cents,category:"Service",pay:"Cash",note:"",date:"2026-10-12",createdAt:10,receipt:null});
const customer=(events:Customer["events"]=[]):Customer=>({id:"customer1",name:"Alem",phone:"0911",events});

describe("lossless three-way financial sync",()=>{
 it("merges independent offline sales from two phones without duplicates",()=>{
  const base=make(),left={...base,entries:[entry("sale-left")]},right={...base,entries:[entry("sale-right")]};
  const r=mergeLedgers(base,left,right);
  expect(r.ok).toBe(true);
  if(r.ok){expect(r.document.entries).toHaveLength(2);expect(new Set(r.document.entries.map(x=>x.id)).size).toBe(2);}
 });
 it("does not overwrite concurrent edits to the same amount",()=>{
  const base={...make(),entries:[entry("one")]};
  const r=mergeLedgers(base,{...base,entries:[entry("one",1300)]},{...base,entries:[entry("one",1450)]});
  expect(r.ok).toBe(false);
  if(!r.ok)expect(r.conflicts.some(c=>c.section==="ledger"&&c.key==="one")).toBe(true);
 });
 it("detects delete versus remote edit, never resurrecting or erasing a record",()=>{
  const base={...make(),entries:[entry("one")]};
  const r=mergeLedgers(base,{...base,entries:[]},{...base,entries:[entry("one",2000)]});
  expect(r.ok).toBe(false);
 });
 it("allows deletion when remote entry was unchanged",()=>{
  const base={...make(),entries:[entry("one")]};
  const r=mergeLedgers(base,{...base,entries:[]},base);
  expect(r.ok).toBe(true);if(r.ok)expect(r.document.entries).toHaveLength(0);
 });
 it("merges new Dube repayments using distinct immutable event IDs",()=>{
  const base={...make(),customers:[customer([{id:"credit",type:"credit" as const,cents:10000,note:"",createdAt:1}])]};
  const original=base.customers[0].events;
  const l={...base,customers:[customer([{id:"pay1",type:"payment",cents:2000,note:"",createdAt:2},...original])]};
  const r={...base,customers:[customer([{id:"pay2",type:"payment",cents:3000,note:"",createdAt:3},...original])]};
  const result=mergeLedgers(base,l,r);
  expect(result.ok).toBe(true);
  if(result.ok)expect(result.document.customers[0].events).toHaveLength(3);
 });
 it("blocks total repayments that exceed outstanding credit",()=>{
  const base={...make(),customers:[customer([{id:"credit",type:"credit" as const,cents:10000,note:"",createdAt:1}])]};
  const original=base.customers[0].events;
  const l={...base,customers:[customer([{id:"pay1",type:"payment",cents:7000,note:"",createdAt:2},...original])]};
  const r={...base,customers:[customer([{id:"pay2",type:"payment",cents:6000,note:"",createdAt:3},...original])]};
  const result=mergeLedgers(base,l,r);
  expect(result.ok).toBe(false);
  if(!result.ok)expect(result.conflicts.some(c=>c.section==="balance")).toBe(true);
 });
 it("never silently drops previously recorded customer repayments",()=>{
  const paid={id:"payment1",type:"payment" as const,cents:1000,note:"",createdAt:2};
  const credit={id:"credit1",type:"credit" as const,cents:5000,note:"",createdAt:1};
  const base={...make(),customers:[customer([credit,paid])]};
  const erased={...base,customers:[customer([credit])]};
  const result=mergeLedgers(base,erased,base);
  expect(result.ok).toBe(false);
  if(!result.ok)expect(result.conflicts.some(x=>x.section==="dube"&&x.key==="payment1")).toBe(true);
 });
 it("never silently deletes a customer with credit history",()=>{
  const base={...make(),customers:[customer([{id:"credit1",type:"credit" as const,cents:5000,note:"",createdAt:1}])]};
  const result=mergeLedgers(base,{...base,customers:[]},base);
  expect(result.ok).toBe(false);
  if(!result.ok)expect(result.conflicts.some(x=>x.section==="dube"&&x.key==="customer1")).toBe(true);
 });
 it("flags colliding local draft references from different devices",()=>{
  const base=make();
  const l={...base,entries:[{...entry("a"),receipt:{number:"DRAFT-000001",status:"draft" as const}}]};
  const r={...base,entries:[{...entry("b"),receipt:{number:"DRAFT-000001",status:"draft" as const}}]};
  const merged=mergeLedgers(base,l,r);
  expect(merged.ok).toBe(false);
  if(!merged.ok)expect(merged.conflicts.some(c=>c.section==="receipt")).toBe(true);
 });
 it("retains device-specific theme and locale",()=>{
  const base=make();
  const local={...base,theme:"dark" as const,locale:"am" as const};
  const remote={...base,theme:"light" as const,entries:[entry("cloud")]};
  const r=mergeLedgers(base,local,remote);
  expect(r.ok).toBe(true);if(r.ok){expect(r.document.theme).toBe("dark");expect(r.document.locale).toBe("am");expect(r.document.entries).toHaveLength(1);}
 });
 it("detects conflicting business identity changes",()=>{
  const base=make();
  const r=mergeLedgers(base,{...base,business:{...base.business,name:"Shop A"}},{...base,business:{...base.business,name:"Shop B"}});
  expect(r.ok).toBe(false);if(!r.ok)expect(r.conflicts[0].section).toBe("business");
 });
 it("checks ledger equality by financial contents, ignoring interface preferences",()=>{
  const a=make();const b={...a,locale:"am" as const,theme:"dark" as const,updatedAt:a.updatedAt+10};
  expect(isSameLedger(a,b)).toBe(true);
 });
});
