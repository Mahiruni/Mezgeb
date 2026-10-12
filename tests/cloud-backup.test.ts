import { describe, expect, it } from "vitest";
import { documentSchema, initialDocument, type Document } from "../src/lib/mezgeb";

const fixture = ():Document => {
 const doc=initialDocument();
 return { ...doc, business:{name:"Meseret Retail",tin:"",phone:"",vatRegistered:false},
  entries:[{id:"6e8efc14-e959-4d56-93bc-441d99a27371",type:"sale",cents:1300,category:"Service",pay:"Cash",note:"",createdAt:Date.now(),date:"2026-10-12",receipt:{number:"DRAFT-000001",status:"draft"}}]
 };
};
describe("cloud-backup validation contract",()=>{
 it("accepts complete valid local-first business documents",()=>expect(documentSchema.safeParse(fixture()).success).toBe(true));
 it("rejects malformed currency values",()=>{
  const value=fixture();value.entries[0].cents=1.99;
  expect(documentSchema.safeParse(value).success).toBe(false);
 });
 it("does not allow forged issued-receipt status",()=>{
  const value=fixture();
  (value.entries[0].receipt as {status:string}).status="issued";
  expect(documentSchema.safeParse(value).success).toBe(false);
 });
 it("drops old client-entitlement and account claims",()=>{
  const value={...fixture(),plan:"premium",accounts:[{email:"fake",password:"unsafe"}]};
  const parsed=documentSchema.parse(value);
  expect(Object.hasOwn(parsed,"plan")).toBe(false);
  expect(Object.hasOwn(parsed,"accounts")).toBe(false);
 });
 it("requires an explicit positive snapshot sequence",()=>{
  const doc=fixture();doc.nextDraft=0;
  expect(documentSchema.safeParse(doc).success).toBe(false);
 });
});


describe("financial import identity validation",()=>{
 it("rejects duplicate transaction IDs rather than losing records during merge",()=>{
  const source=fixture();
  source.entries.push({...source.entries[0],cents:2500});
  expect(documentSchema.safeParse(source).success).toBe(false);
 });
 it("rejects duplicate receipt numbers assigned to distinct sales",()=>{
  const source=fixture();
  source.entries.push({...source.entries[0],id:"d5749f84-565c-47ce-9e89-c1ea99e496b3",cents:3000});
  expect(documentSchema.safeParse(source).success).toBe(false);
 });
 it("rejects duplicate Dube event IDs",()=>{
  const source=fixture();
  source.customers=[{id:"customer-one",name:"Yonas",phone:"",events:[
   {id:"paid-1",type:"credit",cents:2500,note:"",createdAt:1},
   {id:"paid-1",type:"payment",cents:1000,note:"",createdAt:2}
  ]}];
  expect(documentSchema.safeParse(source).success).toBe(false);
 });
});
