import {afterEach,describe,expect,it,vi} from "vitest";
import {exportFile,confirmExport} from "./export-file";
const id="backup-test-id";
function native(status:string){
 const bridge:{onmessage:((e:{data:string})=>void)|null;postMessage:(raw:string)=>void}={onmessage:null,postMessage:vi.fn((raw:string)=>{
  const request=JSON.parse(raw);
  bridge.onmessage?.({data:JSON.stringify({id:request.id,status,message:status==="saved"?"Saved":"Cancelled"})});
 })};
 vi.stubGlobal("window",{MezgebExport:bridge,setTimeout,clearTimeout,confirm:vi.fn(()=>true)});
 vi.stubGlobal("crypto",{randomUUID:()=>id});
 vi.stubGlobal("location",{pathname:"/__mezgeb_native__/1.0.1/settings"});
 return bridge;
}
afterEach(()=>vi.unstubAllGlobals());
describe("Android ledger export safety",()=>{
 it("reports success only after native save confirmation",async()=>{
  const bridge=native("saved");
  await expect(exportFile("mezgeb-backup-2026-11-16.json","{\"version\":2}","application/json")).resolves.toBe("saved");
  expect(bridge.postMessage).toHaveBeenCalledWith(JSON.stringify({id,name:"mezgeb-backup-2026-11-16.json",mime:"application/json",content:"{\"version\":2}"}));
 });
 it("blocks destructive continuation when save is cancelled",async()=>{
  native("cancelled");
  await expect(confirmExport("mezgeb-before-import-2026-11-16.json","{}","application/json")).rejects.toThrow("Cancelled");
 });
 it("rejects non-ledger filenames and unsupported MIME types",async()=>{
  native("saved");
  await expect(exportFile("../private.json","{}","application/json")).rejects.toThrow("Unsupported");
  await expect(exportFile("mezgeb-backup.json","{}","application/octet-stream")).rejects.toThrow("Unsupported");
 });
 it("does not silently pretend unsupported Android downloads are saved",async()=>{
  vi.stubGlobal("window",{});
  vi.stubGlobal("location",{pathname:"/__mezgeb_native__/1.0.1/settings"});
  await expect(exportFile("mezgeb-backup.json","{}","application/json")).rejects.toThrow("does not support");
 });
});
