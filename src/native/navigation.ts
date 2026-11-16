"use client";
import {useSyncExternalStore} from "react";
export const PREFIX="/__mezgeb_native__/1.1.0";
const EVENT="mezgeb-native-navigation";
const ROUTES=new Set(["/","/ledger","/receipts","/reports","/dube","/settings","/plans","/account","/settings-business","/settings-language","/settings-appearance","/settings-tax","/settings-security","/settings-cloud","/settings-backup","/settings-updates","/settings-help","/settings-about","/auth","/auth/status","/auth/update-password","/privacy"]);
export function nativeHref(value:string){const u=new URL(value,location.origin);if(u.origin!==location.origin||u.searchParams.has("nativeOnline")||!ROUTES.has(u.pathname))return value;return PREFIX+(u.pathname==="/" ? "/" : u.pathname)+u.search+u.hash;}
export function logicalPath(){const p=location.pathname;return p.startsWith(PREFIX)?p.slice(PREFIX.length)||"/":p;}
function emit(){window.dispatchEvent(new Event(EVENT));}
function subscribe(cb:()=>void){window.addEventListener("popstate",cb);window.addEventListener(EVENT,cb);return()=>{window.removeEventListener("popstate",cb);window.removeEventListener(EVENT,cb);};}
function snapshot(){return location.pathname+location.search+location.hash;}
export function useNativeLocation(){return useSyncExternalStore(subscribe,snapshot,()=>PREFIX+"/");}
export function usePathname(){useNativeLocation();return logicalPath();}
export function useSearchParams(){useNativeLocation();return new URLSearchParams(location.search);}
export function navigate(href:string,replace=false){const target=nativeHref(href);const u=new URL(target,location.origin);if(u.origin!==location.origin||!u.pathname.startsWith(PREFIX+"/")){location.assign(target);return;}if(replace)history.replaceState(null,"",target);else history.pushState(null,"",target);emit();if(!u.hash)window.scrollTo(0,0);else requestAnimationFrame(()=>document.getElementById(u.hash.slice(1))?.scrollIntoView());}
export function useRouter(){return {push:(href:string)=>navigate(href),replace:(href:string)=>navigate(href,true),refresh:()=>emit(),back:()=>history.back()};}
export function installNativeLinks(){document.addEventListener("click",e=>{if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const a=e.target instanceof Element?e.target.closest("a[href]"):null;if(!(a instanceof HTMLAnchorElement)||a.target||a.hasAttribute("download"))return;const u=new URL(a.href);if(u.origin!==location.origin||u.searchParams.has("nativeOnline"))return;const path=u.pathname.startsWith(PREFIX+"/")?u.pathname.slice(PREFIX.length):u.pathname;if(!ROUTES.has(path))return;e.preventDefault();navigate(path+u.search+u.hash);});}
