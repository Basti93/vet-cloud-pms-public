"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc/client";

export default function AcceptInvitationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const redirectBackUrl = useMemo(() => {
    const qs = searchParams.toString();
    return `/invite/accept${qs ? `?${qs}` : ""}`;
  }, [searchParams]);

  const acceptInvitation = trpc.admin.acceptInvitation.useMutation({
    onSuccess: () => {
      router.replace("/dashboard");
    },
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!token || acceptInvitation.isPending || acceptInvitation.isSuccess) return;
    acceptInvitation.mutate({ token });
  }, [token, acceptInvitation, isLoaded, isSignedIn]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border p-6 space-y-3" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
        <h1 className="text-xl font-semibold">Einladung akzeptieren</h1>
        {!token ? (
          <p style={{ color: "var(--color-muted)" }}>Ungültiger Einladungslink.</p>
        ) : !isLoaded ? (
          <p style={{ color: "var(--color-muted)" }}>Authentifizierung wird geladen...</p>
        ) : !isSignedIn ? (
          <div className="space-y-3">
            <p style={{ color: "var(--color-muted)" }}>
              Bitte registrieren Sie sich oder melden Sie sich an, um die Einladung zu akzeptieren.
            </p>
            <div className="flex gap-2">
              <a
                href={`/sign-up?redirect_url=${encodeURIComponent(redirectBackUrl)}`}
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--color-accent)", color: "white" }}
              >
                Registrieren
              </a>
              <a
                href={`/sign-in?redirect_url=${encodeURIComponent(redirectBackUrl)}`}
                className="px-3 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
              >
                Anmelden
              </a>
            </div>
          </div>
        ) : acceptInvitation.isPending ? (
          <p style={{ color: "var(--color-muted)" }}>Einladung wird verarbeitet...</p>
        ) : acceptInvitation.error ? (
          <p style={{ color: "#991b1b" }}>Fehler: {acceptInvitation.error.message}</p>
        ) : (
          <p style={{ color: "var(--color-muted)" }}>Weiterleitung zum Dashboard...</p>
        )}
      </div>
    </div>
  );
}
