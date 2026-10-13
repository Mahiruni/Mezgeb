"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { initialDocument, loadDocument, saveDocumentIfUnchanged, type Document } from "@/lib/mezgeb";

type Store = {
  doc: Document; ready: boolean; error: string | null;
  update: (change: (previous: Document) => Document) => void;
  replace: (next: Document, alreadyStored?: boolean) => void;
  flush: () => Promise<Document>;
};
const Context = createContext<Store | null>(null);
export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [doc, setDoc] = useState<Document>(initialDocument);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(doc);
  const persisted = useRef<Document | null>(null);
  const storageConflict = useRef<string | null>(null);
  latest.current = doc;

  useEffect(() => {
    let active = true;
    loadDocument().then(value => {
      if (!active) return;
      persisted.current = value;
      setDoc(value); setReady(true);
    }).catch(e => { if(active) setError(e instanceof Error ? e.message : "Could not open device storage."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = doc.theme;
    document.documentElement.lang = doc.locale;
    document.documentElement.dir = doc.locale === "ar" ? "rtl" : "ltr";
    sequence.current = sequence.current.then(async () => {
      if(storageConflict.current) return;
      const base=persisted.current;
      if(!base)throw Error("Device ledger was not initialized.");
      await saveDocumentIfUnchanged(doc,base);
      persisted.current=doc;
      setError(null);
    }).catch(e => {
      const reason=e instanceof Error?e.message:"Failed to save your changes.";
      storageConflict.current=reason;
      setError(reason);
    });
  }, [doc, ready]);

  const update = useCallback((change: (previous: Document) => Document) => {
    setDoc(previous => ({ ...change(previous), updatedAt: Date.now() }));
  }, []);
  const replace = useCallback((next: Document, alreadyStored=false) => {
    // SyncProvider calls replace only AFTER an atomic IndexedDB commit.
    // Advance the expected disk baseline to avoid a false second-tab alert.
    if(alreadyStored)persisted.current=next;
    setDoc({ ...next, updatedAt: Date.now() });
  }, []);

  const flush = useCallback(async () => {
    // A network request cannot proceed if another tab changed IndexedDB.
    await sequence.current;
    if(storageConflict.current)throw Error(storageConflict.current);
    const baseline=persisted.current;
    if(!baseline)throw Error("Device ledger was not initialized.");
    const snapshot=latest.current;
    try{
      await saveDocumentIfUnchanged(snapshot,baseline);
      persisted.current=snapshot;
    }catch(e){
      const reason=e instanceof Error?e.message:"Could not safely verify local records.";
      storageConflict.current=reason;setError(reason);throw e;
    }
    return snapshot;
  }, []);

  return <Context.Provider value={{ doc, ready, error, update, replace, flush }}>
    {children}
  </Context.Provider>;
}
export function useLedger() {
  const store = useContext(Context);
  if (!store) throw Error("useLedger must be inside LedgerProvider");
  return store;
}
