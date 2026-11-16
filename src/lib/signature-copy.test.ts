import {describe,it,expect} from "vitest";
import {stories,tr,words} from "./signature-copy";
import {label} from "./mezgeb";
describe("Signature onboarding and localization",()=>{
 it("keeps exactly seven unique product stories",()=>{expect(stories).toHaveLength(7);expect(new Set(stories.map(s=>s.symbol)).size).toBe(7);});
 it("provides three distinct localized captions on every story",()=>{for(const s of stories){for(const phrase of [s.title,s.body,s.tag,s.feature]){expect(phrase).toHaveLength(3);expect(phrase.every(p=>p.trim().length>0)).toBe(true);}}});
 it("preserves language fallback and supports Afaan Oromo",()=>{expect(tr("am",words.signin)).toBe("ግባ");expect(tr("om",words.signin)).toBe("Seeni");expect(tr("ti",words.signin)).toBe("Sign in");expect(label("om","ledger")).toBe("Galmee");});
});
