"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { initialDocument, loadDocument, saveDocument, type Document } from "@/lib/mezgeb";

type Store = {
  doc: Document; ready: boolean; error: string | null;
  update: (change: (previous: Document) => Document) => void;
  replace: (next: Document) => void;
  flush: () => Promise<Document>;
};
const Context = createContext<Store | null>(null);
export function LedgerProvider({ children }: { children: React.ReactNode }) {
  const [doc, setDoc] = useState<Document>(initialDocument);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(doc);
  latest.current = doc;

  useEffect(() => {
    let active = true;
    loadDocument().then(value => {
      if (!active) return;
      setDoc(value); setReady(true);
    }).catch(e => { if(active) setError(e instanceof Error ? e.message : "Could not open device storage."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = doc.theme;
    document.documentElement.lang = doc.locale;
    document.documentElement.dir = doc.locale === "ar" ? "rtl" : "ltr";
    sequence.current = sequence.current
      .catch(() => undefined)
      .then(() => saveDocument(doc))
      .then(() => setError(null))
      .catch(e => setError(e instanceof Error ? e.message : "Failed to save your changes."));
  }, [doc, ready]);

  const update = useCallback((change: (previous: Document) => Document) => {
    setDoc(previous => ({ ...change(previous), updatedAt: Date.now() }));
  }, []);
  const replace = useCallback((next: Document) => {
    setDoc({ ...next, updatedAt: Date.now() });
  }, []);

  const flush = useCallback(async () => {
    // Wait for the local-first write queue before making any network requests.
    await sequence.current;
    const snapshot = latest.current;
    await saveDocument(snapshot);
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
