import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchange one-time PKCE code for a server-verified cookie session. Restrict
 * redirects to owned paths to prevent auth callback open redirects.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextParam = request.nextUrl.searchParams.get("next");
  const next = nextParam?.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam : "/";
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/auth?error=not-configured", request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/auth?error=invalid-link", request.url));
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth?error=invalid-link", request.url));
  }
  return NextResponse.redirect(new URL(next, request.url));
}
