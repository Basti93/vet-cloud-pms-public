"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const acceptInvitation = trpc.admin.acceptInvitation.useMutation({
    onSuccess: () => {
      router.replace("/dashboard");
    },
  });

  useEffect(() => {
    if (!token || acceptInvitation.isPending || acceptInvitation.isSuccess) return;
    acceptInvitation.mutate({ token });
  }, [token, acceptInvitation]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border p-6 space-y-3" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}>
        <h1 className="text-xl font-semibold">Einladung akzeptieren</h1>
        {!token ? (
          <p style={{ color: "var(--color-muted)" }}>Ungültiger Einladungslink.</p>
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

