import { notFound } from "next/navigation";
import { Workspace } from "../workspace";
const sections = ["ledger","receipts","reports","dube","settings","plans","account","settings-business","settings-language","settings-appearance","settings-tax","settings-security","settings-cloud","settings-backup","settings-updates","settings-help","settings-about"];
export function generateStaticParams(){return sections.map(section=>({section}));}
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections.includes(section))notFound();return <Workspace section={section} />;}
