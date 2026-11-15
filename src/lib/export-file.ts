"use client";
type ExportResult="saved"|"requested";
type NativeReply={id:string;status:string;message?:string};
type Bridge={postMessage:(s:string)=>void;onmessage:((e:{data:string})=>void)|null};
declare global {interface Window {MezgebExport?:Bridge}}
export async function exportFile(name:string,content:string,mime:string):Promise<ExportResult>{
 const normalized=mime.split(";")[0];
 if(!/^mezgeb-[A-Za-z0-9._-]{1,100}\\.(json|csv)$/.test(name)||!["application/json","text/csv"].includes(normalized))throw Error("Unsupported export format.");
 const bytes=new TextEncoder().encode(content);
 if(bytes.length===0||bytes.length>25_000_000)throw Error("Export exceeds the 25 MB limit.");
 const bridge=window.MezgebExport;
 if(bridge){
  const id=crypto.randomUUID();
  return new Promise<ExportResult>((resolve,reject)=>{
   if(bridge.onmessage){reject(Error("Another export is open."));return;}
   let timeout:number;
   const finish=()=>{window.clearTimeout(timeout);bridge.onmessage=null;};
   bridge.onmessage=(event)=>{try{const reply=JSON.parse(event.data) as NativeReply;if(reply.id!==id)return;finish();if(reply.status==="saved")resolve("saved");else reject(Error(reply.message||"Export was not saved."));}catch{}};
   timeout=window.setTimeout(()=>{finish();reject(Error("Export timed out. Verify the backup before continuing."));},300000);
   try{const payload=JSON.stringify({id,name,mime:normalized,content});if(payload.length>25_004_096)throw Error("Export exceeds the Android message limit. Use a smaller backup or the web export.");bridge.postMessage(payload);}catch(e){finish();reject(e);}
  });
 }
 if(location.pathname.startsWith("/__mezgeb_native__/"))throw Error("This Android WebView does not support secure file export. Update Android System WebView and retry.");
 const url=URL.createObjectURL(new Blob([content],{type:mime}));
 const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),10000);
 return "requested";
}
export async function confirmExport(name:string,content:string,mime:string){
 const result=await exportFile(name,content,mime);
 if(result==="requested"&&!window.confirm("Confirm that the backup file was saved and can be opened before continuing."))throw Error("Action stopped because backup was not confirmed.");
}
