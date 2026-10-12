"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpenText, ChartNoAxesCombined, ChevronDown, ClipboardList, FileText, LayoutDashboard, Menu, Moon, Plus, Settings2, ShieldAlert, Sun, Users, X } from "lucide-react";
import { useState } from "react";
import { useLedger } from "@/app/providers";
import { label } from "@/lib/mezgeb";

const nav = [
 {slug:"",key:"home" as const,Icon:LayoutDashboard},
 {slug:"ledger",key:"ledger" as const,Icon:BookOpenText},
 {slug:"receipts",key:"receipts" as const,Icon:FileText},
 {slug:"reports",key:"reports" as const,Icon:ChartNoAxesCombined},
 {slug:"dube",key:"dube" as const,Icon:Users},
 {slug:"settings",key:"settings" as const,Icon:Settings2}
];

export function Shell({ children, onNew }: { children: React.ReactNode; onNew: () => void }) {
 const { doc, error, update } = useLedger();
 const pathname = usePathname();
 const [menu, setMenu] = useState(false);
 const [online, setOnline] = useState(true);
 useState(() => { /* State is initialized offline-safe for server rendering. */ return true; });
 const toggleTheme = () => update(prev => ({ ...prev, theme: prev.theme === "light" ? "dark" : "light" }));
 const links = nav.map(({slug,key,Icon}) => {
  const href = slug ? "/"+slug : "/";
  const active = pathname === href;
  return <Link key={key} className={"nav-link"+(active?" active":"")} href={href} onClick={()=>setMenu(false)} aria-current={active?"page":undefined}><Icon size={19} strokeWidth={active?2.35:1.8}/><span>{label(doc.locale,key)}</span></Link>;
 });
 return <div className="app-layout">
  {menu && <button type="button" className="scrim" onClick={()=>setMenu(false)} aria-label="Close menu" />}
  <aside className={"sidebar"+(menu?" expanded":"")}>
   <div className="brand-wrap"><Link href="/" className="brand" onClick={()=>setMenu(false)}><span className="brand-symbol"><ClipboardList size={23}/></span><span>Mezgeb <small>መዝገብ</small></span></Link><button className="icon-btn sidebar-close" onClick={()=>setMenu(false)} aria-label="Close menu"><X size={20}/></button></div>
   <div className="nav-label">WORKSPACE</div><nav className="side-nav" aria-label="Main navigation">{links}</nav>
   <div className="sidebar-bottom"><div className="sidebar-note"><ShieldAlert size={19}/><div><b>Local preview</b><span>Cloud sync is not connected. Keep a backup of this device&apos;s data.</span></div></div><Link href="/plans" className="plan-link">Mezgeb plans <span>↗</span></Link><div className="built">Built for Ethiopian businesses</div></div>
  </aside>
  <div className="app-main">
   <header className="topbar">
    <div className="top-left"><button type="button" className="icon-btn menu-toggle" aria-label="Open menu" onClick={()=>setMenu(true)}><Menu size={23}/></button><div className="top-business"><span className="top-eyebrow">YOUR WORKSPACE</span><span className="top-title">{doc.business.name || "Mezgeb"} <ChevronDown size={13}/></span></div></div>
    <div className="top-actions"><span className="local-pill"><span className="status-dot" />Local only</span><button className="icon-btn" aria-label="Toggle theme" onClick={toggleTheme}>{doc.theme==="light"?<Moon size={19}/>:<Sun size={19}/>}</button><button type="button" className="avatar" aria-label="Account settings" onClick={()=>location.assign("/settings")}>{doc.business.name.trim()[0]?.toUpperCase()||"M"}</button></div>
   </header>
   {(error) && <div className="storage-error" role="alert"><ShieldAlert size={17}/>{error} — Export a backup and avoid closing the page until resolved.</div>}
   <main className="content">{children}</main>
  </div>
  <nav className="mobile-nav" aria-label="Mobile navigation">{nav.filter(x=>["home","ledger","receipts","reports","settings"].includes(x.key)).map(({slug,key,Icon})=>{
   const href=slug?"/"+slug:"/";const active=pathname===href;
   return <Link href={href} className={"mobile-nav-link"+(active?" active":"")} aria-current={active?"page":undefined} key={key}><Icon size={21} strokeWidth={active?2.3:1.8}/><span>{label(doc.locale,key)}</span></Link>;
  })}</nav>
  <button type="button" className="mobile-fab" onClick={onNew} aria-label="New transaction"><Plus size={25}/></button>
 </div>;
}
