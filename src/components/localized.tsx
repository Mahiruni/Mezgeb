"use client";
import {useLedger} from "@/app/providers";
import type {Locale} from "@/lib/mezgeb";
const dictionary:Record<string,readonly [string,string]>={
"Overview":["አጠቃላይ","Cuunfaa"],
"My account":["መለያዬ","Herrega koo"],
"Account & business":["መለያ እና ንግድ","Herregaa fi daldala"],
"Preferences":["ምርጫዎች","Filannoowwan"],
"Support":["እገዛ","Gargaarsa"],
"Help & introduction":["እገዛ እና መግቢያ","Gargaarsa fi seensa"],
"Privacy & security":["ግላዊነት እና ደህንነት","Iccitii fi nageenya"],
"About Mezgeb":["ስለ መዝገብ","Waa'ee Mezgeb"],
"Sign out":["ውጣ","Ba'i"],
"Search":["ፈልግ","Barbaadi"],
"Search your records":["መዝገቦችዎን ይፈልጉ","Galmee keessan barbaadaa"],
"Search transactions, receipts or customers":["ግብይቶች፣ ደረሰኞች ወይም ደንበኞች ይፈልጉ","Daldala, nagahee ykn maamila barbaadaa"],
"No matching records":["የሚዛመድ መዝገብ የለም","Galmeen walsimu hin jiru"],
"Personal":["የግል","Dhuunfaa"],
"Business":["ንግድ","Daldala"],
"Security & data":["ደህንነት እና መረጃ","Nageenyaa fi odeeffannoo"],
"Application":["መተግበሪያ","Appii"],
"Tax & receipts":["ግብር እና ደረሰኝ","Gibiraa fi nagahee"],
"Account security":["የመለያ ደህንነት","Nageenya herregaa"],
"Edit profile":["መገለጫ አርም","Ibsa gulaali"],
"Save changes":["ለውጦችን አስቀምጥ","Jijjiirama olkaa'i"],
"Full name":["ሙሉ ስም","Maqaa guutuu"],
"Email address":["ኢሜይል","Teessoo imeelii"],
"Guest workspace":["የእንግዳ የሥራ ቦታ","Iddoo hojii keessummaa"],
"Verified email":["የተረጋገጠ ኢሜይል","Imeelii mirkanaa'e"],
"Sign in":["ግባ","Seeni"],
"Create account":["መለያ ፍጠር","Herrega uumi"],
"Back":["ተመለስ","Duubatti"],
"App settings":["የመተግበሪያ ቅንብሮች","Qindaa'ina appii"],
"Saving…":["እየተቀመጠ…","Olkaa'amaa jira…"],
"Saved on this device":["በዚህ መሣሪያ ላይ ተቀምጧል","Meeshaa kana irratti olkaa'ame"],
"Account details":["የመለያ ዝርዝር","Bal'ina herregaa"],
"Keep your records safe":["መዝገቦችዎን ይጠብቁ","Galmee keessan eegi"],
"Review your preferences":["ምርጫዎችዎን ይመልከቱ","Filannoo keessan ilaalaa"],
"Search all records":["ሁሉንም መዝገቦች ፈልግ","Galmee hunda barbaadi"],
"All":["ሁሉም","Hunda"],
"Receipt":["ደረሰኝ","Nagahee"],
"Customer":["ደንበኛ","Maamila"],
"Transaction":["ግብይት","Daldala"],
"Close menu":["ምናሌ ዝጋ","Baafata cufi"],
"Open menu":["ምናሌ ክፈት","Baafata bani"],
"Discard unsaved changes?":["ያልተቀመጡ ለውጦችን ይጣሉ?","Jijjiirama hin olkaa'amne dhiisuu?"],
"Password recovery":["የይለፍ ቃል መመለሻ","Jecha iccitii deebisuu"],
"View privacy notice":["የግላዊነት ማስታወቂያ","Beeksisa iccitii ilaali"],
"Your records stay on this device.":["መዝገቦችዎ በዚህ መሣሪያ ይቆያሉ።","Galmeen keessan meeshaa kana irra tura."],
"No account details available":["የመለያ መረጃ የለም","Odeeffannoon herregaa hin jiru"],
"Local workspace":["የመሣሪያ የሥራ ቦታ","Iddoo hojii meeshaa"],
"Profile saved":["መገለጫ ተቀምጧል","Ibsi olkaa'ame"],
"Choose a language":["ቋንቋ ይምረጡ","Afaan filadhaa"],
"Choose a theme":["ገጽታ ይምረጡ","Bifa filadhaa"],
"More":["ተጨማሪ","Dabalata"],
"Prepare secure update":["ደህንነቱ የተጠበቀ ዝመና አዘጋጅ","Haaromsa nageenya qabu qopheessi"],
"Check Android package update":["የአንድሮይድ ዝመና ፈልግ","Haaromsa Android ilaali"],

  "DAILY LEDGER": [
    "ዕለታዊ መዝገብ",
    "Galmee guyyaa"
  ],
  "Sale": [
    "ሽያጭ",
    "Gurgurtaa"
  ],
  "Expense": [
    "ወጪ",
    "Baasii"
  ],
  "Amount (ETB)": [
    "መጠን (ብር)",
    "Hamma (ETB)"
  ],
  "Date": [
    "ቀን",
    "Guyyaa"
  ],
  "Category": [
    "ምድብ",
    "Gosa"
  ],
  "Payment method": [
    "የክፍያ መንገድ",
    "Mala kaffaltii"
  ],
  "Note (optional)": [
    "ማስታወሻ (አማራጭ)",
    "Yaadannoo (filannoo)"
  ],
  "Prepare a draft receipt": [
    "ረቂቅ ደረሰኝ አዘጋጅ",
    "Nagahee wixinee qopheessi"
  ],
  "Delete": [
    "ሰርዝ",
    "Haqi"
  ],
  "Cancel": [
    "ይቅር",
    "Dhiisi"
  ],
  "Save transaction": [
    "ግብይት አስቀምጥ",
    "Daldala olkaa’i"
  ],
  "Receipts": [
    "ደረሰኞች",
    "Nagahee"
  ],
  "Receipt details": [
    "የደረሰኝ ዝርዝር",
    "Bal’ina nagahee"
  ],
  "Reference": [
    "ማጣቀሻ",
    "Wabii"
  ],
  "Payment": [
    "ክፍያ",
    "Kaffaltii"
  ],
  "Total": [
    "ጠቅላላ",
    "Waliigala"
  ],
  "Close": [
    "ዝጋ",
    "Cufi"
  ],
  "Print draft": [
    "ረቂቅ አትም",
    "Wixinee maxxansi"
  ],
  "Add customer": [
    "ደንበኛ ጨምር",
    "Maamila dabali"
  ],
  "Customers": [
    "ደንበኞች",
    "Maamiltoota"
  ],
  "Name": [
    "ስም",
    "Maqaa"
  ],
  "Save customer": [
    "ደንበኛ አስቀምጥ",
    "Maamila olkaa’i"
  ],
  "DUBE CREDIT BOOK": [
    "የዱቤ መዝገብ",
    "Galmee liqii"
  ],
  "Balance owed": [
    "ያልተከፈለ ሂሳብ",
    "Haftee liqii"
  ],
  "Add credit": [
    "ዱቤ ጨምር",
    "Liqii dabali"
  ],
  "Record payment": [
    "ክፍያ መዝግብ",
    "Kaffaltii galmeessi"
  ],
  "History": [
    "ታሪክ",
    "Seenaa"
  ],
  "No credit entries yet.": [
    "ገና የዱቤ መዝገብ የለም።",
    "Galmeen liqii ammaaf hin jiru."
  ],
  "Export CSV": [
    "CSV አውጣ",
    "CSV baasi"
  ],
  "Sales & expenses": [
    "ሽያጭ እና ወጪ",
    "Gurgurtaa fi baasii"
  ],
  "Daily": [
    "ዕለታዊ",
    "Guyyaa guyyaan"
  ],
  "VAT overview": [
    "የቫት አጠቃላይ ሁኔታ",
    "Haala VAT"
  ],
  "Estimated · 15%": [
    "ግምት · 15%",
    "Tilmaama · 15%"
  ],
  "Output VAT": [
    "የሽያጭ ቫት",
    "VAT gurgurtaa"
  ],
  "Estimated input VAT*": [
    "የግዢ ቫት ግምት*",
    "Tilmaama VAT bittaa*"
  ],
  "Estimated VAT due": [
    "የሚከፈል ቫት ግምት",
    "Tilmaama VAT kaffalamu"
  ],
  "App updates": [
    "የመተግበሪያ ዝመናዎች",
    "Haaromsa appii"
  ],
  "Update interface now": [
    "ገጽታውን አሁን አዘምን",
    "Bifa amma haaromsi"
  ],
  "Business profile": [
    "የንግድ መገለጫ",
    "Ibsa daldalaa"
  ],
  "Business name": [
    "የንግድ ስም",
    "Maqaa daldalaa"
  ],
  "Phone": [
    "ስልክ",
    "Bilbila"
  ],
  "Phone (optional)": [
    "ስልክ (አማራጭ)",
    "Bilbila (filannoo)"
  ],
  "Save business details": [
    "የንግድ መረጃ አስቀምጥ",
    "Odeeffannoo daldalaa olkaa’i"
  ],
  "Experience": [
    "የአጠቃቀም ልምድ",
    "Muuxannoo"
  ],
  "Language": [
    "ቋንቋ",
    "Afaan"
  ],
  "Appearance": [
    "ገጽታ",
    "Bifa"
  ],
  "Light": [
    "ብርሃን",
    "Ifaa"
  ],
  "Dark": [
    "ጨለማ",
    "Dukkana"
  ],
  "Data & backup": [
    "መረጃ እና ምትኬ",
    "Odeeffannoo fi kuusaa"
  ],
  "Download JSON backup": [
    "JSON ምትኬ አውርድ",
    "Kuusaa JSON buufadhu"
  ],
  "Account & cloud": [
    "መለያ እና ደመና",
    "Herregaa fi duumessa"
  ],
  "Cloud synchronization": [
    "የደመና ማመሳሰል",
    "Wal-simsiisa duumessaa"
  ],
  "Not connected": [
    "አልተገናኘም",
    "Hin wal qunnamne"
  ],
  "Opening your ledger…": [
    "መዝገብዎ እየተከፈተ ነው…",
    "Galmeen keessan banamaa jira…"
  ],
  "New sale": [
    "አዲስ ሽያጭ",
    "Gurgurtaa haaraa"
  ],
  "New expense": [
    "አዲስ ወጪ",
    "Baasii haaraa"
  ],
  "Dube book": [
    "የዱቤ መዝገብ",
    "Galmee liqii"
  ],
  "Reports": [
    "ሪፖርቶች",
    "Gabaasa"
  ],
  "Transactions": [
    "ግብይቶች",
    "Daldalawwan"
  ],
  "All types": [
    "ሁሉም ዓይነቶች",
    "Gosoota hunda"
  ],
  "Sales": [
    "ሽያጭ",
    "Gurgurtaa"
  ],
  "Expenses": [
    "ወጪዎች",
    "Baasii"
  ],
  "No records yet": [
    "ገና መዝገብ የለም",
    "Galmeen ammaaf hin jiru"
  ],
  "No transactions yet": [
    "ገና ግብይት የለም",
    "Daldalli ammaaf hin jiru"
  ],
  "No receipts yet": [
    "ገና ደረሰኝ የለም",
    "Nagaheen ammaaf hin jiru"
  ],
  "RECORDS & DOCUMENTS": [
    "መዝገቦች እና ሰነዶች",
    "Galmee fi sanada"
  ],
  "CUSTOMER CREDIT": [
    "የደንበኛ ዱቤ",
    "Liqii maamilaa"
  ],
  "Dube · ዱቤ": [
    "ዱቤ",
    "Liqii"
  ],
  "Total outstanding": [
    "ጠቅላላ ያልተከፈለ",
    "Liqii waliigalaa"
  ],
  "Active customers": [
    "ንቁ ደንበኞች",
    "Maamiltoota socho’an"
  ],
  "YOUR NUMBERS": [
    "የእርስዎ ቁጥሮች",
    "Lakkoofsa keessan"
  ],
  "Reports & insights": [
    "ሪፖርቶች እና ግንዛቤ",
    "Gabaasaa fi hubannoo"
  ],
  "Gross sales": [
    "ጠቅላላ ሽያጭ",
    "Gurgurtaa waliigalaa"
  ],
  "Net result": [
    "የተጣራ ውጤት",
    "Bu’aa qulqulluu"
  ],
  "PREFERENCES & BUSINESS": [
    "ምርጫዎች እና ንግድ",
    "Filannoo fi daldala"
  ],
  "Settings": [
    "ቅንብሮች",
    "Qindaa’ina"
  ],
  "MEZGEB PLANS": [
    "የመዝገብ ዕቅዶች",
    "Karoora Mezgeb"
  ],
  "Grow with Mezgeb": [
    "ከመዝገብ ጋር ያድጉ",
    "Mezgeb waliin guddadhaa"
  ],
  "YOUR BUSINESS AT A GLANCE": [
    "ንግድዎ በአንድ እይታ",
    "Daldala keessan ija tokkoon"
  ],
  "ALL YOUR TRANSACTIONS": [
    "ሁሉም ግብይቶችዎ",
    "Daldalawwan keessan hunda"
  ],
  "WORKSPACE": [
    "የሥራ ቦታ",
    "Iddoo hojii"
  ],
  "YOUR WORKSPACE": [
    "የእርስዎ የሥራ ቦታ",
    "Iddoo hojii keessan"
  ],
  "Mezgeb plans": [
    "የመዝገብ ዕቅዶች",
    "Karoora Mezgeb"
  ],
  "On-device": [
    "በመሣሪያ ላይ",
    "Meeshaa irratti"
  ],
  "Cloud synced": [
    "ከደመና ጋር ተመሳስሏል",
    "Duumessa waliin wal-simsiifame"
  ],
  "Syncing…": [
    "እየተመሳሰለ…",
    "Wal-simsiisaa jira…"
  ],
  "Sync conflict": [
    "የማመሳሰል ግጭት",
    "Walitti bu’iinsa wal-simsiisaa"
  ],
  "Offline": [
    "ከመስመር ውጪ",
    "Sarara alaa"
  ],
  "Sync error": [
    "የማመሳሰል ስህተት",
    "Dogoggora wal-simsiisaa"
  ],
  "Check for updates": [
    "ዝመና ፈልግ",
    "Haaromsa ilaali"
  ],
  "Edit transaction": [
    "ግብይት አርም",
    "Daldala gulaali"
  ],
  "New transaction": [
    "አዲስ ግብይት",
    "Daldala haaraa"
  ]
};
export function localize(locale:Locale,source:string){const item=dictionary[source];return item?(locale==="am"?item[0]:locale==="om"?item[1]:source):source;}
export function Localized({text}:{text:string}){const {doc}=useLedger();return <>{localize(doc.locale,text)}</>;}
