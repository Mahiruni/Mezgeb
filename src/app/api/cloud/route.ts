import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { documentSchema } from "@/lib/mezgeb";
import { z } from "zod";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers });

async function authenticated() {
  const client = await createClient();
  if (!client) return null;
  // Never authorize financial data access via unvalidated getSession() user data.
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : { client, userId: data.user.id };
}

async function ownedBusiness(client: NonNullable<Awaited<ReturnType<typeof authenticated>>>["client"], userId: string) {
  return client.from("businesses").select("id,name").eq("owner_id", userId).maybeSingle();
}

/** Download your explicitly saved snapshot. Never return data from other owners. */
export async function GET() {
  const auth = await authenticated();
  if (!auth) return fail(401, "Sign in to your Mezgeb account first.");
  try {
    const { data: business, error } = await ownedBusiness(auth.client, auth.userId);
    if (error) throw error;
    if (!business) return NextResponse.json({ business: null, snapshot: null }, { headers });
    const result = await auth.client
      .from("business_snapshots")
      .select("payload,revision,updated_at")
      .eq("business_id", business.id)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return NextResponse.json({ business: business.name, snapshot: null }, { headers });
    const validated = documentSchema.safeParse(result.data.payload);
    if (!validated.success) return fail(409, "The cloud backup needs review. No data has been changed.");
    return NextResponse.json({
      business: business.name,
      snapshot: {
        document: validated.data,
        revision: result.data.revision,
        updatedAt: result.data.updated_at,
      },
    }, { headers });
  } catch {
    return fail(500, "Could not read cloud backup. Your local data remains unchanged.");
  }
}

const uploadSchema = z.object({
  document: documentSchema,
  expectedRevision: z.number().int().positive().nullable(),
});

/**
 * Explicit, user-initiated backup; compare-and-swap revision prevents silent
 * overwrites. This is not offline auto-sync and not certified receipt issuance.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticated();
  if (!auth) return fail(401, "Sign in to your Mezgeb account first.");
  if (Number(request.headers.get("content-length") || "0") > 2_250_000) {
    return fail(413, "The backup is too large for this preview.");
  }
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 2_250_000) {
      return fail(413, "The backup is too large for this preview.");
    }
    const payload = uploadSchema.safeParse(JSON.parse(raw));
    if (!payload.success) return fail(422, "The backup is invalid. Export a local copy and check your records.");
    const { document, expectedRevision } = payload.data;
    if (!document.business.name.trim()) return fail(422, "Set up your business name before backing up.");

    let { data: business, error: businessError } = await ownedBusiness(auth.client, auth.userId);
    if (businessError) throw businessError;
    if (!business) {
      if (expectedRevision !== null) return fail(409, "No cloud ledger exists for this account yet.");
      const created = await auth.client.from("businesses").insert({
        owner_id: auth.userId,
        name: document.business.name,
        tin: document.business.tin,
        phone: document.business.phone,
        vat_registered: document.business.vatRegistered,
      }).select("id,name").single();
      if (created.error) {
        // A concurrent first upload could have already created the business.
        const existing = await ownedBusiness(auth.client, auth.userId);
        if (existing.error || !existing.data) return fail(409, "Business setup conflicted. Refresh cloud status and retry.");
        business = existing.data;
      } else {
        business = created.data;
      }
    }
    if (!business) return fail(500, "Business setup was incomplete.");

    if (expectedRevision === null) {
      // Duplicate first uploads must not replace existing snapshots.
      const insert = await auth.client.from("business_snapshots").insert({
        business_id: business.id,
        payload: document,
      }).select("revision,updated_at").single();
      if (insert.error) {
        if (insert.error.code === "23505") return fail(409, "Cloud data already exists. Refresh before uploading.");
        throw insert.error;
      }
      return NextResponse.json({
        revision: insert.data.revision,
        updatedAt: insert.data.updated_at,
        message: "Cloud backup saved.",
      }, { headers });
    }

    const update = await auth.client.from("business_snapshots")
      .update({ payload: document })
      .eq("business_id", business.id)
      .eq("revision", expectedRevision)
      .select("revision,updated_at")
      .maybeSingle();
    if (update.error) throw update.error;
    if (!update.data) return fail(409, "The cloud backup changed on another device. Refresh and compare before uploading.");

    return NextResponse.json({
      revision: update.data.revision,
      updatedAt: update.data.updated_at,
      message: "Cloud backup updated.",
    }, { headers });
  } catch {
    return fail(500, "The cloud backup could not be saved. Your on-device records were not deleted.");
  }
}
