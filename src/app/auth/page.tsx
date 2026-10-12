import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AccountForm } from "./account-form";

export const dynamic = "force-dynamic";
export default function AuthPage(){
  const connected = isSupabaseConfigured();
  return <AccountForm enabled={connected}/>;
}
