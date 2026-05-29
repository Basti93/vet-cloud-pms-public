"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OPEN_FEEDBACK_EVENT, type OpenFeedbackDetail } from "./feedback-events";

type DashboardFeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSourceModule: string;
};

const CATEGORY_OPTIONS = [
  { value: "bug", label: "Problem" },
  { value: "idea", label: "Idee" },
  { value: "question", label: "Frage" },
  { value: "other", label: "Sonstiges" },
] as const;

export function inferFeedbackModule(pathname: string) {
  if (pathname.includes("/book/") || pathname.startsWith("/dashboard/bookings")) return "booking";
  if (/^\/dashboard\/patients\/[^/]+/.test(pathname)) return "medical-records";
  const segment = pathname.split("/").filter(Boolean)[1] ?? "dashboard";
  return segment || "dashboard";
}

export function DashboardFeedbackDialog({
  open,
  onOpenChange,
  defaultSourceModule,
}: DashboardFeedbackDialogProps) {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]["value"]>("other");
  const [sourceOverride, setSourceOverride] = useState<OpenFeedbackDetail>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const sourcePath = sourceOverride.sourcePath ?? pathname;
  const sourceModule = sourceOverride.sourceModule ?? defaultSourceModule;

  const submitFeedback = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      setMessage("");
      setCategory("other");
      setErrorMessage("");
      setSuccessMessage("Danke, Feedback wurde gesendet.");
      window.setTimeout(() => {
        setSuccessMessage("");
        onOpenChange(false);
      }, 1200);
    },
    onError: (error) => {
      setSuccessMessage("");
      setErrorMessage(error.message || "Feedback konnte nicht gesendet werden.");
    },
  });

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<OpenFeedbackDetail>;
      setSourceOverride(customEvent.detail ?? {});
      setSuccessMessage("");
      setErrorMessage("");
      onOpenChange(true);
    };

    window.addEventListener(OPEN_FEEDBACK_EVENT, handler);
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, handler);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      setSourceOverride({});
      setErrorMessage("");
      setSuccessMessage("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="feedback-dialog">
        <DialogHeader>
          <DialogTitle>Feedback senden</DialogTitle>
          <DialogDescription>
            Beschreiben Sie kurz, was fehlt, unklar ist oder nicht funktioniert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="grid gap-1 text-sm font-medium text-[var(--color-fg)]">
            Kategorie
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as typeof category)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium text-[var(--color-fg)]">
            Nachricht
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              maxLength={4000}
              className="resize-none rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              placeholder="Was sollen wir verbessern?"
              data-testid="feedback-message"
            />
          </label>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Bitte keine unnötigen personenbezogenen Daten, Tierhalterdaten oder medizinischen Details einfügen.
          </p>

          <p className="text-xs text-[var(--color-muted)]">
            Kontext: {sourceModule} · {sourcePath}
          </p>

          {successMessage ? <p className="text-sm text-green-700">{successMessage}</p> : null}
          {errorMessage ? <p className="text-sm text-red-700">{errorMessage}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            type="button"
            loading={submitFeedback.isPending}
            disabled={!message.trim()}
            onClick={() =>
              submitFeedback.mutate({
                message,
                category,
                sourcePath,
                sourceModule,
                browserMetadata:
                  typeof window === "undefined"
                    ? undefined
                    : {
                        viewport: {
                          width: window.innerWidth,
                          height: window.innerHeight,
                        },
                        language: window.navigator.language,
                      },
              })
            }
            data-testid="submit-feedback"
          >
            <MessageSquare size={16} />
            Senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
