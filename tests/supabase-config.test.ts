import {afterEach,describe,expect,it} from "vitest";
import {getSupabaseConfig,MEZGEB_SUPABASE_HOST} from "../src/lib/supabase/config";
afterEach(()=>{
 delete process.env.NEXT_PUBLIC_SUPABASE_URL;
 delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});
describe("Mezgeb Supabase connection safety",()=>{
 it("disables integration when no configuration is set",()=>{
  expect(getSupabaseConfig()).toBeNull();
 });
 it("rejects unrelated project URLs even on supabase.co",()=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://eyyvvwecpyctttiueban.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_test";
  expect(getSupabaseConfig()).toBeNull();
 });
 it("rejects a userinfo, alternate port, path or query",()=>{
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_test";
  for(const url of [
   "https://user:password@"+MEZGEB_SUPABASE_HOST,
   "https://"+MEZGEB_SUPABASE_HOST+":8080",
   "https://"+MEZGEB_SUPABASE_HOST+"/rest/v1",
   "https://"+MEZGEB_SUPABASE_HOST+"/?key=anything",
   "http://"+MEZGEB_SUPABASE_HOST
  ]){
   process.env.NEXT_PUBLIC_SUPABASE_URL=url;
   expect(getSupabaseConfig()).toBeNull();
  }
 });
 it("rejects service-role / secret keys configured as public keys",()=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://"+MEZGEB_SUPABASE_HOST;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_secret_never_in_browser";
  expect(getSupabaseConfig()).toBeNull();
 });
 it("accepts the verified dedicated project using a publishable key",()=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://"+MEZGEB_SUPABASE_HOST+"/";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_test";
  expect(getSupabaseConfig()).toEqual({url:"https://"+MEZGEB_SUPABASE_HOST,publishableKey:"sb_publishable_test"});
 });
});
