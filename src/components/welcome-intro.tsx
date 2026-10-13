"use client";
import Link from "next/link";
import { ArrowRight, BookOpenText, ChartNoAxesCombined, ReceiptText, ShieldCheck, Wallet } from "lucide-react";

export function WelcomeIntro({onStart}:{onStart:()=>void}){
 return <main className="intro-page">
  <div className="intro-orbit intro-orbit-one" aria-hidden="true"/><div className="intro-orbit intro-orbit-two" aria-hidden="true"/>
  <header className="intro-header"><div className="intro-brand"><span className="intro-mark"><BookOpenText size={23}/></span><span>Mezgeb <small>መዝገብ</small></span></div><Link className="intro-signin" href="/auth">Sign in <ArrowRight size={16}/></Link></header>
  <div className="intro-center"><span className="intro-overline"><span className="intro-dot"/> MADE FOR ETHIOPIAN BUSINESSES</span><h1>Every birr.<br/><em>Beautifully in order.</em></h1><p>Meet your calmer way to manage your business — sales, expenses, Dube credit, and receipts, thoughtfully together.</p>
  <div className="intro-benefits"><span><Wallet size={17}/> Track daily money</span><span><ReceiptText size={17}/> Organize records</span><span><ChartNoAxesCombined size={17}/> See your progress</span></div>
  <button className="intro-cta" onClick={onStart} type="button">Get started <span><ArrowRight size={20}/></span></button><Link href="/auth" className="intro-restore">Already use Mezgeb? Sign in and restore</Link></div>
  <footer className="intro-footer"><span><ShieldCheck size={15}/> Your ledger stays on this device until you choose verified cloud sync.</span><span>Mezgeb by Hisab Technologies</span></footer>
 </main>;
}
