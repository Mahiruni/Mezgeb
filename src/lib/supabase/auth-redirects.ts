/** Strict redirect destinations for Supabase email confirmation/recovery. */
export function authCallbackDestination(type:string|null,next:string|null):"/auth/update-password"|"/auth/status"{
 return (type==="recovery" || next==="/auth/update-password")?"/auth/update-password":"/auth/status";
}
export function allowedEmailOtpType(type:string|null):type is "signup"|"email"|"recovery"|"email_change"|"invite"|"magiclink"{
 return type==="signup"||type==="email"||type==="recovery"||type==="email_change"||type==="invite"||type==="magiclink";
}
