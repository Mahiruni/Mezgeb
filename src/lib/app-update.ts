export const APP_VERSION="1.1.1";
export const APP_VERSION_CODE=13;
export type UpdateInfo={version:string;notes:string[];bytes?:number};
function notes(value:unknown,locale:string):string[]{if(!value||typeof value!=="object")return [];const map=value as Record<string,unknown>;const selected=map[locale]??map.en;return Array.isArray(selected)?selected.filter((s):s is string=>typeof s==="string").slice(0,12).map(s=>s.slice(0,500)):[];}
export function parseUpdate(value:unknown,native:boolean,locale:string):UpdateInfo|null{
 if(!value||typeof value!=="object")throw Error("Invalid update metadata");
 const m=value as Record<string,unknown>;
 if(native){
  if(m.available===false)return null;
  if(m.available!==true||typeof m.versionName!=="string"||!/^\d+\.\d+\.\d+$/.test(m.versionName)||typeof m.versionCode!=="number"||!Number.isSafeInteger(m.versionCode)||m.versionCode<1||typeof m.bytes!=="number"||!Number.isSafeInteger(m.bytes)||m.bytes<1||m.bytes>150*1024*1024||typeof m.apkPath!=="string"||!/^\/releases\/[A-Za-z0-9._-]+\.apk$/.test(m.apkPath)||typeof m.sha256!=="string"||! /^[a-fA-F0-9]{64}$/.test(m.sha256))throw Error("Invalid Android update metadata");
  return m.versionCode>APP_VERSION_CODE?{version:m.versionName,bytes:m.bytes,notes:notes(m.notes,locale)}:null;
 }
 if(typeof m.version!=="string"||!/^\d+\.\d+\.\d+$/.test(m.version))throw Error("Invalid interface update metadata");
 const a=APP_VERSION.split(".").map(Number),v=m.version.split(".").map(Number);return v.some((n,i)=>n>a[i]&&v.slice(0,i).every((x,j)=>x===a[j]))?{version:m.version,notes:notes(m.notes,locale)}:null;
}
