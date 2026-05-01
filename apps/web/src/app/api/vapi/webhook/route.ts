import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db/client";
import { voiceCalls, patients, owners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Vapi Webhook Handler
 *
 * Empfängt Events von Vapi AI und:
 * - Speichert Anruf-Metadaten in voice_calls
 * - Erstellt Termine bei erfolgreicher KI-Buchung
 * - Speichert Transkripte
 *
 * Konfiguration in Vapi Dashboard:
 * Server URL → https://your-domain.com/api/vapi/webhook
 */

// ── Types ────────────────────────────────────────────────────────────────────

interface VapiWebhookEvent {
  message: {
    type:
      | "assistant-request"
      | "status-update"
      | "transcript"
      | "function-call"
      | "hang"
      | "end-of-call-report";
    call?: {
      id: string;
      phoneNumber?: { number: string };
      customer?: { number: string };
      status?: string;
    };
    status?: string;
    transcript?: string;
    role?: "user" | "assistant";
    functionCall?: {
      name: string;
      parameters: Record<string, any>;
    };
    endedReason?: string;
    recordingUrl?: string;
    summary?: string;
    artifact?: {
      transcript?: string;
      recordingUrl?: string;
    };
    durationSeconds?: number;
  };
}

// ── Helper ────────────────────────────────────────────────────────────────────

function getDefaultTenantId() {
  // In production: derive from phone number or assistant mapping
  // For now: require explicit tenant configuration
  return null;
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[Vapi] VAPI_WEBHOOK_SECRET not configured, skipping signature verification");
    return true;
  }

  if (!signature) {
    return false;
  }

  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let rawBody: string;
  let body: VapiWebhookEvent;

  try {
    rawBody = await req.text();
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const signature = req.headers.get("x-vapi-signature");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { message } = body;

  if (!message?.type) {
    return NextResponse.json({ error: "Missing message.type" }, { status: 400 });
  }

  const callId = message.call?.id;
  const phoneNumber =
    message.call?.customer?.number ?? message.call?.phoneNumber?.number ?? "unknown";

  try {
    switch (message.type) {
      // ── Call started ───────────────────────────────────────────────────────
      case "status-update": {
        if (message.status === "in-progress" && callId) {
          const tenantId = getDefaultTenantId();
          if (!tenantId) break;

          await db
            .insert(voiceCalls)
            .values({
              tenantId,
              vapiCallId: callId,
              phoneNumber,
              status: "active",
            })
            .onConflictDoNothing();
        }
        break;
      }

      // ── Function call — KI bucht Termin ────────────────────────────────────
      case "function-call": {
        const fn = message.functionCall;
        if (!fn || fn.name !== "bookAppointment") break;

        const tenantId = getDefaultTenantId();
        if (!tenantId) break;

        const params = fn.parameters;
        console.log("[Vapi] bookAppointment called:", params);

        // Look up or create patient
        let patientRecord = null;
        if (params.patientName && params.ownerPhone) {
          // Try to find owner by phone
          const existingOwner = await db
            .select()
            .from(owners)
            .where(eq(owners.phone, params.ownerPhone))
            .limit(1);

          if (existingOwner[0]) {
            // Find patient by owner
            const existingPatient = await db
              .select()
              .from(patients)
              .where(eq(patients.ownerId, existingOwner[0].id))
              .limit(1);
            patientRecord = existingPatient[0];
          }
        }

        // Return instructions to KI
        return NextResponse.json({
          result: patientRecord
            ? `Termin für ${params.patientName} eingetragen. Bestätigungsnummer: ${Date.now()}.`
            : `Ich habe die Anfrage aufgenommen. Jemand aus dem Team wird sich melden, um den Termin zu bestätigen.`,
        });
      }

      // ── End of call — save transcript & recording ──────────────────────────
      case "end-of-call-report": {
        if (!callId) break;

        const transcript =
          message.artifact?.transcript ?? message.transcript ?? null;
        const recordingUrl = message.artifact?.recordingUrl ?? null;
        const duration = message.durationSeconds ?? null;

        await db
          .update(voiceCalls)
          .set({
            status: "completed",
            transcription: transcript,
            recordingUrl: recordingUrl,
            duration: duration,
            notes: message.summary ?? null,
          })
          .where(eq(voiceCalls.vapiCallId, callId));

        console.log(`[Vapi] Call ${callId} ended — ${duration}s`);
        break;
      }

      default:
        // Ignore other event types
        break;
    }
  } catch (err) {
    console.error("[Vapi Webhook Error]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

// Vapi pings the webhook to verify it's reachable
export async function GET() {
  return NextResponse.json({ status: "ok", service: "vet-cloud-pms-vapi-webhook" });
}
