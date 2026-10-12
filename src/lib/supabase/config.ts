/** Mezgeb's finance API MUST connect only to its dedicated Supabase project.
 * Public publishable keys are safe; NEVER expose service-role / secret keys.
 * This fail-closed project pin blocks accidental cross-product data access if
 * someone copies an environment variable from NexRide or another project.
 */
export const MEZGEB_SUPABASE_HOST = "pqfzkyssvxmboprkmdga.supabase.co";
export function getSupabaseConfig(): {url:string;publishableKey:string}|null {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
 const publishableKey=(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
 if(!url||!publishableKey||publishableKey.startsWith("sb_secret_"))return null;
 try{
  const parsed=new URL(url);
  if(parsed.protocol!=="https:"||parsed.hostname!==MEZGEB_SUPABASE_HOST ||
   parsed.username||parsed.password||parsed.search||parsed.hash ||
   (parsed.pathname!=="/"&&parsed.pathname!=="") || parsed.port)return null;
  return {url:parsed.origin,publishableKey};
 }catch{return null;}
}
export function isSupabaseConfigured():boolean{return getSupabaseConfig()!==null;}
