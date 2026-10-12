import { describe, expect, it } from "vitest";
import { creditBalance, csv, initialDocument, money, outstanding, parseLegacy, toCents, totals, vatCents, type Entry } from "../src/lib/mezgeb";

const row=(type:"sale"|"expense",cents:number,category="Service"):Entry=>({
 id:type+"-"+cents,type,cents,category,pay:"Cash",note:"",date:"2026-10-12",createdAt:1791800000000,receipt:null
});
describe("money and VAT arithmetic",()=>{
 it("rejects fractional cents and negative inputs",()=>{expect(toCents("12.34")).toBe(1234);expect(()=>toCents("12.345")).toThrow();expect(()=>toCents("-1")).toThrow();});
 it("calculates 15% tax from VAT-inclusive price",()=>expect(vatCents(11500)).toBe(1500));
 it("uses integer cents for financial totals",()=>{
  const r=totals([row("sale",11500),row("expense",2300,"Stock purchase")],"2026-10",true);
  expect(r.sales).toBe(11500);expect(r.expenses).toBe(2300);expect(r.outputVat).toBe(1500);expect(r.inputVat).toBe(300);expect(r.vatDue).toBe(1200);
 });
 it("does not apply VAT to non-registered businesses",()=>expect(totals([row("sale",11500)],undefined,false).outputVat).toBe(0));
 it("correctly scopes totals by month",()=>expect(totals([row("sale",10000)],"2026-11").sales).toBe(0));
});
describe("credit book",()=>{
 const customer={id:"c1",name:"A",phone:"",events:[
  {id:"x",type:"credit" as const,cents:12000,note:"",createdAt:1},
  {id:"y",type:"payment" as const,cents:4000,note:"",createdAt:2}
 ]};
 it("reconciles credit and payments",()=>expect(creditBalance(customer)).toBe(8000));
 it("tracks total positive outstanding",()=>expect(outstanding([customer])).toBe(8000));
});
describe("legacy import",()=>{
 it("imports old entries without trusting paid plan or account data",()=>{
  const imported=parseLegacy(JSON.stringify({biz:"Test Shop",entries:[{id:"1",type:"sale",amount:115,cat:"Goods",pay:"cash",ts:1791800000000,receipt:{sn:"FS-000001"}}],dube:[],plan:"premium",accounts:[{password:"unsafe"}]}));
  expect(imported.business.name).toBe("Test Shop");expect(imported.entries[0].cents).toBe(11500);
  expect(imported.entries[0].receipt?.status).toBe("legacy");expect("accounts" in imported).toBe(false);
  expect("plan" in imported).toBe(false);
 });
 it("rejects invalid structures",()=>expect(()=>parseLegacy(JSON.stringify({entries:"not-an-array"}))).toThrow());
});
describe("exports",()=>{
 it("escapes CSV cells",()=>expect(csv([{...row("sale",2500),note:'Hello,"world"'}])).toContain('"Hello,""world"""'));
 it("creates a new local document without users or passwords",()=>{
  const data=initialDocument();expect(data.version).toBe(2);expect(data.entries).toEqual([]);
 });
});
