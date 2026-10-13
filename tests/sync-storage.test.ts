import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
 commitCloudSnapshot, initialDocument, loadDocument, readRecoveryCopies,
 readSyncMeta, saveDocument, saveDocumentIfUnchanged, storeSyncMeta, type Document, type SyncMeta
} from "../src/lib/mezgeb";

const id="55a033be-4387-4e85-84b1-7b690a5b230a";
function documentWith(amount?:number):Document{
 const data=initialDocument();
 data.business.name="Addis Mini Market";
 if(amount)data.entries.push({
  id:"6d1a9741-a345-4e6d-a000-3495e64d9941",
  type:"sale",cents:amount,category:"Stock",pay:"Cash",note:"",
  date:"2026-10-12",createdAt:1791800000000,receipt:null
 });
 return data;
}
function checkpoint(document:Document,revision:number):SyncMeta{
 return {key:"active",accountId:id,revision,base:document,enabled:true,lastSyncedAt:Date.now()};
}
describe("durable local sync checkpoint and recovery",()=>{
 it("commits downloaded records and matching checkpoint within a transaction",async()=>{
  const initial=documentWith();
  await saveDocument(initial);
  await storeSyncMeta(checkpoint(initial,1));
  const downloaded=documentWith(2500);
  await commitCloudSnapshot(downloaded,checkpoint(downloaded,2),initial,"Before remote merge");
  const local=await loadDocument();
  const meta=await readSyncMeta();
  const recovery=await readRecoveryCopies(id);
  expect(local.entries.map(e=>e.cents)).toEqual([2500]);
  expect(meta?.revision).toBe(2);
  expect(meta?.base.entries).toEqual(local.entries);
  expect(recovery[0]?.document.entries).toHaveLength(0);
  expect(recovery[0]?.reason).toBe("Before remote merge");
 });
 it("refuses invalid checkpoints without modifying the local ledger",async()=>{
  const previous=await loadDocument();
  const invalid={...checkpoint(documentWith(),3),accountId:"another-user"};
  await expect(commitCloudSnapshot(documentWith(9999),invalid,previous)).rejects.toThrow();
  const current=await loadDocument();
  expect(current.entries).toEqual(previous.entries);
  expect((await readSyncMeta())?.revision).toBe(2);
 });
});


describe("persistent recovery review gate",()=>{
 it("remembers a review hold across IndexedDB reads",async()=>{
  const paused={...checkpoint(documentWith(3000),10),holdForReview:true as const};
  await storeSyncMeta(paused);
  const restored=await readSyncMeta();
  expect(restored?.holdForReview).toBe(true);
  expect(restored?.revision).toBe(10);
  await expect(storeSyncMeta({...paused,holdForReview:false})).rejects.toThrow(/review hold/);
  await storeSyncMeta({...paused,holdForReview:false},true);
 });
});

describe("Phase 3 — crash-safe local and multi-tab writes",()=>{
 it("rejects a stale tab's IndexedDB save instead of deleting newer transactions",async()=>{
  const before=documentWith(3100);
  await saveDocument(before);
  const changed=documentWith(4600);
  await saveDocumentIfUnchanged(changed,before);
  const stale=documentWith(8000);
  await expect(saveDocumentIfUnchanged(stale,before)).rejects.toThrow(/Another Mezgeb tab/);
  expect((await loadDocument()).entries[0].cents).toBe(4600);
 });
 it("refuses to roll a cloud checkpoint back after another tab synced",async()=>{
  const before=checkpoint(documentWith(4000),40);
  await storeSyncMeta(before);
  await expect(storeSyncMeta(checkpoint(documentWith(5000),39))).rejects.toThrow(/Another tab/);
  expect((await readSyncMeta())?.revision).toBe(40);
 });
 it("restores a local recovery and durable review hold in one transaction",async()=>{
  const previous=documentWith(6500);
  const recovered=documentWith(7000);
  await saveDocument(previous);
  const checkpointBefore=checkpoint(previous,41);
  await storeSyncMeta(checkpointBefore);
  await commitCloudSnapshot(recovered,{...checkpointBefore,holdForReview:true},previous,
   "Before restoring a historic financial recovery");
  expect((await loadDocument()).entries[0].cents).toBe(7000);
  expect((await readSyncMeta())?.holdForReview).toBe(true);
  expect((await readRecoveryCopies(id))[0].document.entries[0].cents).toBe(6500);
  await expect(storeSyncMeta(checkpoint(recovered,41))).rejects.toThrow(/review hold/);
 });
 it("rejects an atomic cloud replacement if a second tab edited IndexedDB",async()=>{
  const original=documentWith(9000);
  const otherTab=documentWith(9900);
  const fromCloud=documentWith(12300);
  await saveDocument(original);
  await storeSyncMeta(checkpoint(original,42),true);
  await saveDocument(otherTab);
  await expect(commitCloudSnapshot(fromCloud,checkpoint(fromCloud,43),original,
    "Attempted stale restore")).rejects.toThrow(/Another tab/);
  expect((await loadDocument()).entries[0].cents).toBe(9900);
  expect((await readSyncMeta())?.revision).toBe(42);
 });
});
