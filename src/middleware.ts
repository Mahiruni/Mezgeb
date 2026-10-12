import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

/**
 * Next.js 15 cookie refresh middleware. This is intentionally a no-op until
 * the user connects a dedicated Mezgeb Supabase project.
 */
export async function middleware(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookieUpdates) {
        cookieUpdates.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookieUpdates.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options));
      }
    }
  });
  await supabase.auth.getClaims();
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|.*\\.(?:png|jpg|jpeg|webp|gif|ico)).*)"]
};
