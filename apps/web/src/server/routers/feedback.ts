import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc";
import { tenants, userFeedback, users } from "@/lib/db/schema";
import { sendTenantLifecycleEmail } from "@/lib/email/service";
// eslint-disable-next-line no-restricted-imports -- audit call is inside if (created) guard; additional admin notification logic follows the audit call inside the same branch
import { writeAuditLog } from "@/server/audit";
import { logEventAsync, serializeLogError } from "@/server/trpc/logging-middleware";

const feedbackCategorySchema = z.enum(["bug", "idea", "question", "other"]);

async function notifySystemAdminsOfFeedback(input: {
  tenantId: string;
  tenantName: string;
  userEmail: string | null;
  feedbackId: string;
  message: string;
  category: string;
  sourceModule: string;
  sourcePath: string;
}) {
  const adminIds = (process.env.ADMIN_CLERK_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (adminIds.length === 0) {
    logEventAsync({
      level: "warn",
      category: "email",
      eventType: "feedback_admin_notification_skipped",
      message: "No ADMIN_CLERK_IDS configured for feedback admin email",
      tenantId: input.tenantId,
      metadata: { operation: "user_feedback_submitted", feedbackId: input.feedbackId },
    });
    return;
  }

  const clerk = await clerkClient();
  const recipients = (
    await Promise.all(
      adminIds.map(async (id) => {
        try {
          const user = await clerk.users.getUser(id);
          return user.emailAddresses?.[0]?.emailAddress ?? null;
        } catch {
          return null;
        }
      })
    )
  ).filter((email): email is string => Boolean(email));

  if (recipients.length === 0) {
    logEventAsync({
      level: "warn",
      category: "email",
      eventType: "feedback_admin_notification_skipped",
      message: "Could not resolve any admin recipient emails from ADMIN_CLERK_IDS",
      tenantId: input.tenantId,
      metadata: {
        operation: "user_feedback_submitted",
        feedbackId: input.feedbackId,
        adminIdsCount: adminIds.length,
      },
    });
    return;
  }

  const body = `
Neues Produktfeedback wurde gesendet.

Praxis: ${input.tenantName}
Tenant ID: ${input.tenantId}
Nutzer: ${input.userEmail ?? "Unbekannt"}
Kategorie: ${input.category}
Modul: ${input.sourceModule}
Pfad: ${input.sourcePath}
Feedback ID: ${input.feedbackId}

Nachricht:
${input.message}
  `.trim();

  for (const recipient of recipients) {
    const result = await sendTenantLifecycleEmail({
      to: recipient,
      practiceName: input.tenantName,
      subject: `Neues Feedback: ${input.tenantName}`,
      body,
    });

    if (!result.success) {
      logEventAsync({
        level: "error",
        category: "email",
        eventType: "feedback_admin_notification_failed",
        message: "Failed to send feedback notification to system admin",
        tenantId: input.tenantId,
        metadata: {
          operation: "user_feedback_submitted",
          feedbackId: input.feedbackId,
          recipient,
          ...serializeLogError(result.error),
        },
      });
    }
  }
}

export const feedbackRouter = createTRPCRouter({
  submit: tenantProcedure
    .input(
      z.object({
        message: z.string().trim().min(1).max(4000),
        category: feedbackCategorySchema.default("other"),
        sourcePath: z.string().trim().min(1).max(500),
        sourceModule: z.string().trim().min(1).max(80),
        browserMetadata: z
          .object({
            viewport: z
              .object({
                width: z.number().int().positive().optional(),
                height: z.number().int().positive().optional(),
              })
              .optional(),
            language: z.string().max(80).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, dbUserId } = ctx as { tenantId: string; dbUserId: string };

      const [created] = await ctx.db
        .insert(userFeedback)
        .values({
          tenantId,
          userId: dbUserId,
          message: input.message,
          category: input.category,
          sourcePath: input.sourcePath,
          sourceModule: input.sourceModule,
          browserMetadata: input.browserMetadata ?? null,
          ipAddress: ctx.headers.get("x-forwarded-for"),
          userAgent: ctx.headers.get("user-agent"),
        })
        .returning({
          id: userFeedback.id,
          status: userFeedback.status,
          createdAt: userFeedback.createdAt,
        });

      if (created) {
        await writeAuditLog(ctx, {
          tenantId,
          action: "create",
          entity: { type: "user_feedback", id: created.id },
          event: "feedback.submitted",
          summary: "User submitted product feedback",
          changes: {
            category: input.category,
            sourceModule: input.sourceModule,
            sourcePath: input.sourcePath,
          },
        });

        const [[tenant], [user]] = await Promise.all([
          ctx.adminDb
            .select({ name: tenants.name })
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .limit(1),
          ctx.adminDb
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, dbUserId))
            .limit(1),
        ]);

        try {
          await notifySystemAdminsOfFeedback({
            tenantId,
            tenantName: tenant?.name ?? "Unbekannte Praxis",
            userEmail: user?.email ?? null,
            feedbackId: created.id,
            message: input.message,
            category: input.category,
            sourceModule: input.sourceModule,
            sourcePath: input.sourcePath,
          });
        } catch (error) {
          logEventAsync({
            level: "error",
            category: "email",
            eventType: "feedback_admin_notification_failed",
            message: "Feedback admin notification failed unexpectedly",
            tenantId,
            metadata: {
              operation: "user_feedback_submitted",
              feedbackId: created.id,
              ...serializeLogError(error),
            },
          });
        }
      }

      return created;
    }),
});
