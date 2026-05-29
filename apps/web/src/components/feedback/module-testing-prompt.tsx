"use client";

import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openFeedbackDialog } from "./feedback-events";

type ModuleTestingPromptProps = {
  moduleKey: string;
  moduleName: string;
  sourcePath: string;
};

export function ModuleTestingPrompt({
  moduleKey,
  moduleName,
  sourcePath,
}: ModuleTestingPromptProps) {
  return (
    <div
      className="mb-4 flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"
      style={{
        backgroundColor: "var(--color-accent-soft)",
        borderColor: "var(--color-border)",
        color: "var(--color-fg)",
      }}
      data-testid="module-testing-prompt"
    >
      <div>
        <p className="font-semibold">Modul im Test: {moduleName}</p>
        <p className="mt-1 text-[var(--color-muted)]">
          Bitte nutzen und Feedback senden, wenn etwas fehlt oder hakt.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => openFeedbackDialog({ sourceModule: moduleKey, sourcePath })}
      >
        <MessageSquare size={16} />
        Feedback
      </Button>
    </div>
  );
}
