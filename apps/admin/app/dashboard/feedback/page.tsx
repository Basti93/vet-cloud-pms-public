"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

type FeedbackStatus = "all" | "new" | "reviewing" | "planned" | "done" | "dismissed";
type FeedbackCategory = "all" | "bug" | "idea" | "question" | "other";
type FeedbackPriority = "all" | "low" | "normal" | "high";

type FeedbackItem = {
  id: string;
  tenantId: string;
  tenantName?: string | null;
  userEmail?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
  sourcePath: string;
  sourceModule: string;
  message: string;
  category: Exclude<FeedbackCategory, "all">;
  status: Exclude<FeedbackStatus, "all">;
  priority: Exclude<FeedbackPriority, "all">;
  triageNotes?: string | null;
  updatedByAdminClerkId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  browserMetadata?: unknown;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusClass(status: string) {
  if (status === "new") return "bg-blue-100 text-blue-800";
  if (status === "reviewing") return "bg-yellow-100 text-yellow-800";
  if (status === "planned") return "bg-purple-100 text-purple-800";
  if (status === "done") return "bg-green-100 text-green-800";
  return "bg-gray-100 text-gray-700";
}

function priorityClass(priority: string) {
  if (priority === "high") return "bg-red-100 text-red-800";
  if (priority === "low") return "bg-gray-100 text-gray-700";
  return "bg-sky-100 text-sky-800";
}

export default function FeedbackPage() {
  const [status, setStatus] = useState<FeedbackStatus>("all");
  const [category, setCategory] = useState<FeedbackCategory>("all");
  const [priority, setPriority] = useState<FeedbackPriority>("all");
  const [tenantId, setTenantId] = useState("all");
  const [sourceModule, setSourceModule] = useState("");
  const [search, setSearch] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const utils = trpc.useUtils();
  const tenants = trpc.adminDashboard.core.listTenants.useQuery(
    { limit: 100 },
    { refetchOnWindowFocus: false }
  );

  const filters = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      category: category === "all" ? undefined : category,
      priority: priority === "all" ? undefined : priority,
      tenantId: tenantId === "all" ? undefined : tenantId,
      sourceModule: sourceModule.trim() || undefined,
      search: search.trim() || undefined,
      limit: 50,
    }),
    [category, priority, search, sourceModule, status, tenantId]
  );

  const feedback = trpc.adminDashboard.feedback.list.useQuery(filters, {
    refetchInterval: 300_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const summary = trpc.adminDashboard.feedback.getSummary.useQuery(undefined, {
    enabled: feedback.isSuccess,
    refetchInterval: 300_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const updateFeedback = trpc.adminDashboard.feedback.update.useMutation({
    onSuccess: async () => {
      await utils.adminDashboard.feedback.list.invalidate();
      await utils.adminDashboard.feedback.getSummary.invalidate();
    },
  });

  const items = feedback.data?.items ?? [];

  const updateItem = (
    item: FeedbackItem,
    patch: Partial<Pick<FeedbackItem, "status" | "priority">> & { triageNotes?: string | null }
  ) => {
    updateFeedback.mutate({
      feedbackId: item.id,
      ...patch,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Feedback</h2>
        <p className="mt-1 text-sm text-gray-500">
          Produktfeedback aus dem Praxis-Dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Gesamt" value={summary.data?.total ?? 0} />
        <KpiCard title="Neu" value={summary.data?.newCount ?? 0} />
        <KpiCard title="In Prüfung" value={summary.data?.reviewingCount ?? 0} />
        <KpiCard title="Hohe Priorität" value={summary.data?.highPriorityCount ?? 0} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Suche
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nachricht, Praxis, E-Mail"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as FeedbackStatus)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle</option>
              <option value="new">Neu</option>
              <option value="reviewing">In Prüfung</option>
              <option value="planned">Geplant</option>
              <option value="done">Erledigt</option>
              <option value="dismissed">Verworfen</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Kategorie
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle</option>
              <option value="bug">Problem</option>
              <option value="idea">Idee</option>
              <option value="question">Frage</option>
              <option value="other">Sonstiges</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Priorität
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as FeedbackPriority)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle</option>
              <option value="high">Hoch</option>
              <option value="normal">Normal</option>
              <option value="low">Niedrig</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Mandant
            <select
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle</option>
              {tenants.data?.items?.map((tenant: { id: string; name: string }) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Modul
            <input
              value={sourceModule}
              onChange={(event) => setSourceModule(event.target.value)}
              placeholder="medical-records"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm normal-case tracking-normal text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      {feedback.isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          Lädt Feedback...
        </div>
      ) : feedback.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Fehler: {feedback.error.message}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          Kein Feedback gefunden
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item: FeedbackItem) => {
            const noteValue = notesById[item.id] ?? item.triageNotes ?? "";
            return (
              <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                        {item.status}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${priorityClass(item.priority)}`}>
                        {item.priority}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        {item.category}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(item.createdAt)}</span>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {item.tenantName ?? item.tenantId}
                      </p>
                      <p className="text-sm text-gray-600">
                        {[item.userFirstName, item.userLastName].filter(Boolean).join(" ") || "Unbekannter Nutzer"}
                        {item.userEmail ? ` · ${item.userEmail}` : ""}
                      </p>
                    </div>

                    <p className="whitespace-pre-wrap text-sm text-gray-800">{item.message}</p>

                    <div className="grid gap-1 text-xs text-gray-500">
                      <p>Modul: {item.sourceModule}</p>
                      <p>Pfad: {item.sourcePath}</p>
                      <p>IP: {item.ipAddress || "-"}</p>
                      <p className="break-all">Browser: {item.userAgent || "-"}</p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Status
                      <select
                        value={item.status}
                        onChange={(event) =>
                          updateItem(item, { status: event.target.value as FeedbackItem["status"] })
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-gray-900"
                      >
                        <option value="new">Neu</option>
                        <option value="reviewing">In Prüfung</option>
                        <option value="planned">Geplant</option>
                        <option value="done">Erledigt</option>
                        <option value="dismissed">Verworfen</option>
                      </select>
                    </label>

                    <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Priorität
                      <select
                        value={item.priority}
                        onChange={(event) =>
                          updateItem(item, { priority: event.target.value as FeedbackItem["priority"] })
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-gray-900"
                      >
                        <option value="high">Hoch</option>
                        <option value="normal">Normal</option>
                        <option value="low">Niedrig</option>
                      </select>
                    </label>

                    <label className="grid gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Triage-Notiz
                      <textarea
                        value={noteValue}
                        onChange={(event) =>
                          setNotesById((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                        rows={4}
                        className="resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-gray-900"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={updateFeedback.isPending}
                      onClick={() => updateItem(item, { triageNotes: noteValue || null })}
                      className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Notiz speichern
                    </button>

                    {item.updatedByAdminClerkId ? (
                      <p className="text-xs text-gray-500">
                        Zuletzt bearbeitet von {item.updatedByAdminClerkId} am {formatDate(item.updatedAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
