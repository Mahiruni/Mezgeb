import type {Document} from "../mezgeb";
import {isSameLedger} from "./merge";

/** Returns a safe action for a verified account that has never paired this browser.
 * Never infer permission to overwrite divergent financial records.
 */
export type AutoPairAction="wait-for-business"|"upload-new-cloud"|"restore-empty-device"|"link-identical"|"review-different-records";
export function isPristineDevice(doc:Document):boolean{
 return !doc.business.name.trim() && !doc.business.tin.trim() &&
   !doc.business.phone.trim() && doc.entries.length===0 &&
   doc.customers.length===0 && doc.nextDraft===1;
}
export function decideAutoPair(device:Document,cloud:Document|null):AutoPairAction{
 if(!cloud)return device.business.name.trim()?"upload-new-cloud":"wait-for-business";
 if(isSameLedger(device,cloud))return "link-identical";
 if(isPristineDevice(device))return "restore-empty-device";
 return "review-different-records";
}
