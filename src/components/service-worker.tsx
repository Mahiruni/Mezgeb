"use client";
import { useEffect } from "react";
export function ServiceWorker(){
 useEffect(()=>{
  if("serviceWorker" in navigator&&location.protocol==="https:"){
   void navigator.serviceWorker.register("/sw.js").catch(error=>console.warn("Mezgeb service worker registration unavailable:",error));
  }
 },[]);
 return null;
}
