"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cloud, CloudDownload, CloudUpload, RefreshCw, LogOut, ShieldCheck } from "lucide-react";
import { useLedger } from "@/app/providers";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { type Document } from "@/lib/mezgeb";

type Saved = { document: Document; revision: number; updatedAt: string };
type Status = "loading" | "signedOut" | "ready" | "busy" | "unavailable" | "error";
type CloudResponse = { business: string | null; snapshot: Saved | null; error?: string };
const configured = Boolean(getSupabaseConfig());

function downloadLocal(document: Document) {
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = "mezgeb-before-cloud-restore-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Manual cloud backup. No background sync, automatic merges, or certified fiscal issuance. */
export function CloudBackup() {
  const { doc, replace } = useLedger();
  const [status, setStatus] = useState<Status>(configured ? "loading" : "unavailable");
  const [remote, setRemote] = useState<Saved | null>(null);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    if (!configured) return;
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/cloud", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) { setStatus("signedOut"); setRemote(null); return; }
      const result = await response.json() as CloudResponse;
      if (!response.ok) throw Error(result.error || "Could not load cloud status.");
      setRemote(result.snapshot);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Could not reach cloud backup.");
    }
  };
  useEffect(() => { void refresh(); /* connection state is deliberately loaded only on mount */ }, []);

  const upload = async () => {
    if (status !== "ready") return;
    const text = remote
      ? "Replace cloud revision " + remote.revision + " with the ledger currently on this device? Cloud-only changes from another device will be lost. First export and compare any cloud data you need."
      : "Save a copy of this device's ledger to your private Mezgeb cloud backup? This will not turn on automatic synchronization.";
    if (!window.confirm(text)) return;
    setStatus("busy"); setMessage("");
    try {
      const res = await fetch("/api/cloud", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: doc, expectedRevision: remote?.revision ?? null }),
      });
      const value = await res.json() as { revision?: number; updatedAt?: string; error?: string };
      if (!res.ok) {
        if (res.status === 409) setRemote(null);
        throw Error(value.error || "Cloud backup could not be saved.");
      }
      setRemote({ document: doc, revision: value.revision!, updatedAt: value.updatedAt! });
      setMessage("Cloud backup saved. Changes are not uploaded again until you explicitly back them up.");
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Cloud backup failed.");
    }
  };

  const restore = () => {
    if (!remote || status !== "ready") return;
    const ask = window.confirm("Restore the cloud ledger onto this device? A JSON backup of the current local ledger will download first. Confirm only if you want to replace this device's current entries and Dube records.");
    if (!ask) return;
    try {
      downloadLocal(doc);
      replace(remote.document);
      setMessage("Cloud snapshot restored locally. A safety copy of your prior device ledger was downloaded.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not restore backup.");
    }
  };

  const signOut = async () => {
    if (!window.confirm("Sign out of the Mezgeb cloud account? Device-only ledger data will remain in this browser.")) return;
    try {
      await createClient().auth.signOut();
      setRemote(null); setStatus("signedOut"); setMessage("Signed out. Local records remain on this device.");
    } catch {
      setMessage("Could not sign out; try again.");
    }
  };

  return <section className="surface settings-section cloud-section" aria-label="Mezgeb cloud backup">
    <div className="surface-title"><h2>Cloud backup</h2><Cloud size={19}/></div>
    <p className="muted">Optional, secure, account-based snapshots. **Not** live multi-device synchronization; your ledger still saves locally first.</p>
    {!configured && <p className="notice">Supabase is not configured in this deployment. Local backups remain available above.</p>}
    {configured && status === "loading" && <p className="muted">Checking account and backup status…</p>}
    {configured && status === "signedOut" && <div className="cloud-status">
      <span>Not signed in</span><p>Sign in before storing a cloud backup.</p>
      <Link className="btn primary" href="/auth">Sign in or create account</Link>
    </div>}
    {configured && status === "ready" && <div className="cloud-status">
      <div className="integration-row"><span><ShieldCheck size={18}/> Authenticated account</span><b>Connected</b></div>
      <div className="integration-row"><span><Cloud size={18}/> Backup saved</span><b>{remote ? "Revision " + remote.revision : "Not yet"}</b></div>
      {remote && <p className="muted">Saved {new Date(remote.updatedAt).toLocaleString()} · {remote.document.entries.length} ledger entries · {remote.document.customers.length} Dube customers</p>}
      <div className="cloud-buttons">
        <button className="btn primary" type="button" onClick={()=>void upload()}><CloudUpload size={17}/> {remote?"Replace cloud backup":"Back up this device"}</button>
        <button className="btn subtle" disabled={!remote} type="button" onClick={restore}><CloudDownload size={17}/> Restore onto device</button>
      </div>
      <button className="btn ghost muted" type="button" onClick={()=>void signOut()}><LogOut size={17}/> Sign out</button>
    </div>}
    {configured && status === "busy" && <p className="muted" role="status">Saving a protected cloud copy…</p>}
    {configured && status === "error" && <button className="btn subtle" type="button" onClick={()=>void refresh()}><RefreshCw size={17}/> Recheck account and backup</button>}
    {message && <p className={status==="error"?"form-error":"muted"} role="status">{message}</p>}
    {configured && status === "ready" && <p className="muted">A backup is copied only when you press the button. Use JSON export for an additional independent copy. Concurrent uploads are rejected rather than silently overwriting newer snapshots.</p>}
  </section>;
}
