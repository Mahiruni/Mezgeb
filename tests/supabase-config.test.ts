import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseConfig } from "../src/lib/supabase/config";
afterEach(()=>{
 delete process.env.NEXT_PUBLIC_SUPABASE_URL;
 delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});
describe("Supabase readiness",()=>{
 it("disables account integration when unset",()=>{delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;expect(getSupabaseConfig()).toBeNull();});
 it("rejects untrusted origins",()=>{process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.com";process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="key";expect(getSupabaseConfig()).toBeNull();});
 it("requires a valid configured project",()=>{process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co";process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="publishable";expect(getSupabaseConfig()).toEqual({url:"https://example.supabase.co",publishableKey:"publishable"});});
});
