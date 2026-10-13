import {describe,expect,it} from "vitest";
import {initialDocument,type Document} from "../src/lib/mezgeb";
import {decideAutoPair,isPristineDevice} from "../src/lib/sync/auto-pair";

const blank=()=>initialDocument();
const filled=():Document=>({...initialDocument(),business:{
 name:"Meseret Market",tin:"",phone:"",vatRegistered:false
}});
describe("automatic first-time cloud pairing",()=>{
 it("waits for new businesses without uploading an empty snapshot",()=>{
  expect(decideAutoPair(blank(),null)).toBe("wait-for-business");
 });
 it("uploads new business records when the verified account has no cloud data",()=>{
  expect(decideAutoPair(filled(),null)).toBe("upload-new-cloud");
 });
 it("restores existing cloud records to a genuinely empty device",()=>{
  expect(decideAutoPair(blank(),filled())).toBe("restore-empty-device");
 });
 it("links identical records without overwriting either copy",()=>{
  const ledger=filled();
  expect(decideAutoPair(ledger,{...ledger,theme:"dark",locale:"am"})).toBe("link-identical");
 });
 it("stops before replacing different non-empty financial records",()=>{
  const device=filled();
  const cloud={...filled(),business:{...filled().business,name:"Another business"}};
  expect(decideAutoPair(device,cloud)).toBe("review-different-records");
 });
 it("never silently replaces financial entries even if the business name is blank",()=>{
  const device=blank();
  device.entries.push({id:"tx-one",type:"sale",cents:1000,category:"Service",pay:"Cash",
    note:"",createdAt:Date.now(),date:"2026-10-13",receipt:null});
  expect(isPristineDevice(device)).toBe(false);
  expect(decideAutoPair(device,filled())).toBe("review-different-records");
 });
 it("never overwrites business profile metadata on a partly configured device",()=>{
  const device=blank();
  device.business.tin="1234567890";
  expect(isPristineDevice(device)).toBe(false);
  expect(decideAutoPair(device,filled())).toBe("review-different-records");
 });
 it("never infers cloud restore for a device containing Dube customers",()=>{
  const device=blank();
  device.customers=[{id:"c",name:"Customer",phone:"",events:[]}];
  expect(decideAutoPair(device,filled())).toBe("review-different-records");
 });
});
