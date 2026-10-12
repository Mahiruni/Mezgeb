import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase PKCE code exchange and token-hash email confirmations.
 * Only redirect to two hardcoded destinations; never trust arbitrary next URLs.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const recovery = type === "recovery" || requestedNext === "/auth/update-password";
  const destination = recovery ? "/auth/update-password" : "/";
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/auth?error=not-configured", request.url));
  }
  let valid = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    valid = !error;
  } else if (tokenHash && (type === "signup" || type === "email" || type === "recovery")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash:tokenHash, type });
    valid = !error;
  }
  if (!valid) {
    return NextResponse.redirect(new URL("/auth?error=invalid-link", request.url));
  }
  return NextResponse.redirect(new URL(destination, request.url));
}
