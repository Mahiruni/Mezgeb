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
