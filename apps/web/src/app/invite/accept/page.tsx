import { Suspense } from "react";
import AcceptInvitationClient from "./page-client";

function InviteAcceptFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div
        className="max-w-md w-full rounded-xl border p-6"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}
      >
        <p style={{ color: "var(--color-muted)" }}>Einladung wird geladen...</p>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<InviteAcceptFallback />}>
      <AcceptInvitationClient />
    </Suspense>
  );
}
