import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** PKCE callback with a fixed allowlist of internal destinations. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = requestedNext === "/auth/update-password"
    ? "/auth/update-password" : "/";
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
