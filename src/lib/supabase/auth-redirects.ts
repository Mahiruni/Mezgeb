/** Strict redirect destinations for Supabase email confirmation/recovery. */
export function authCallbackDestination(type:string|null,next:string|null):"/auth/update-password"|"/auth/status"{
 return (type==="recovery" || next==="/auth/update-password")?"/auth/update-password":"/auth/status";
}
export function allowedEmailOtpType(type:string|null):type is "signup"|"email"|"recovery"{
 return type==="signup"||type==="email"||type==="recovery";
}
