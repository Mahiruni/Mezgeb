import {describe,it,expect} from "vitest";
import {allowedEmailOtpType,authCallbackDestination} from "../src/lib/supabase/auth-redirects";

describe("email verification and password recovery destinations",()=>{
 it("sends signup confirmations to the server-side session check",()=>{
  expect(authCallbackDestination("signup",null)).toBe("/auth/status");
  expect(authCallbackDestination("email",null)).toBe("/auth/status");
 });
 it("keeps legitimate recovery flow on password reset",()=>{
  expect(authCallbackDestination("recovery",null)).toBe("/auth/update-password");
  expect(authCallbackDestination(null,"/auth/update-password")).toBe("/auth/update-password");
 });
 it("does not accept open redirects or arbitrary next parameters",()=>{
  for(const bad of ["//outside.example","https://outside.example","/api/cloud","/auth/update-password/evil"]){
   expect(authCallbackDestination("email",bad)).toBe("/auth/status");
  }
 });
 it("accepts only confirmed Supabase email OTP families",()=>{
  expect(allowedEmailOtpType("signup")).toBe(true);
  expect(allowedEmailOtpType("email")).toBe(true);
  expect(allowedEmailOtpType("recovery")).toBe(true);
  expect(allowedEmailOtpType("magiclink")).toBe(false);
  expect(allowedEmailOtpType("email_change")).toBe(false);
  expect(allowedEmailOtpType(null)).toBe(false);
 });
});
