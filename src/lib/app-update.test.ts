import {describe,it,expect} from "vitest";
import {parseUpdate} from "./app-update";
const candidate={available:true,versionName:"1.1.2",versionCode:14,bytes:1900000,apkPath:"/releases/mezgeb.apk",sha256:"a".repeat(64),notes:{en:["New release"],am:["ዝመና"]}};
describe("settings update metadata",()=>{
 it("does not advertise unpublished releases",()=>expect(parseUpdate({available:false},true,"en")).toBeNull());
 it("requires newer native version code and valid manifest",()=>{expect(parseUpdate(candidate,true,"am")).toEqual({version:"1.1.2",bytes:1900000,notes:["ዝመና"]});expect(parseUpdate({...candidate,versionCode:13},true,"en")).toBeNull();});
 it("rejects unsafe paths and incomplete integrity metadata",()=>{expect(()=>parseUpdate({...candidate,apkPath:"https://elsewhere.test/a.apk"},true,"en")).toThrow();expect(()=>parseUpdate({...candidate,sha256:"bad"},true,"en")).toThrow();});
 it("separates web and Android release metadata",()=>{expect(parseUpdate({version:"1.1.2",notes:{en:["Web"]}},false,"en")?.version).toBe("1.1.2");expect(()=>parseUpdate({version:"1.1.2"},true,"en")).toThrow();});
});
