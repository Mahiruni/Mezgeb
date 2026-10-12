import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { allowedEmailOtpType, authCallbackDestination } from "@/lib/supabase/auth-redirects";

/**
 * Complete Supabase PKCE / token-hash verification on the same browser that
 * initiated the flow. Never redirect to caller-supplied arbitrary URLs.
 */
export async function GET(request:NextRequest) {
 const code=request.nextUrl.searchParams.get("code");
 const tokenHash=request.nextUrl.searchParams.get("token_hash");
 const type=request.nextUrl.searchParams.get("type");
 const next=request.nextUrl.searchParams.get("next");
 const destination=authCallbackDestination(type,next);
 const client=await createClient();
 if(!client)return NextResponse.redirect(new URL("/auth?error=not-configured",request.url));
 let verified=false;
 if(code){
  const {error}=await client.auth.exchangeCodeForSession(code);
  verified=!error;
 }else if(tokenHash && allowedEmailOtpType(type)){
  const {error}=await client.auth.verifyOtp({token_hash:tokenHash,type});
  verified=!error;
 }
 if(verified){
  // Verify that the exchanged session was actually committed and the
  // provider confirms email ownership before showing success.
  const {data,error}=await client.auth.getUser();
  verified=!error&&Boolean(data.user?.email_confirmed_at);
 }
 if(!verified)return NextResponse.redirect(new URL("/auth?error=invalid-link",request.url));
 return NextResponse.redirect(new URL(destination,request.url));
}
