"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type FullCalendarType from "@fullcalendar/react";
import { Plus, ChevronLeft, ChevronRight, Calendar, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentStatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentModal } from "@/components/appointments/AppointmentModal";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";

// FullCalendar must be SSR-disabled (uses browser APIs).
// We load our forwardRef wrapper so the ref prop is typed correctly.
const FullCalendar = dynamic(
  () => import("@/components/FullCalendarWrapper"),
  { ssr: false }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  scheduled: { bg: "#3B82F6", border: "#2563EB" },
  completed: { bg: "#10B981", border: "#059669" },
  cancelled: { bg: "#EF4444", border: "#DC2626" },
  "no-show": { bg: "#F59E0B", border: "#D97706" },
};

type ApptDetail = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: string;
  patientId: string;
  vetId: string;
  description: string | null;
  patientName: string | null;
  patientSpecies: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerPhone: string | null;
};

function toCalEvent(a: ApptDetail) {
  const c = STATUS_COLORS[a.status] ?? STATUS_COLORS.scheduled;
  return {
    id: a.id,
    title: a.patientName ? `${a.patientName} — ${a.title}` : a.title,
    start: new Date(a.startTime),
    end: new Date(a.endTime),
    backgroundColor: c.bg,
    borderColor: c.border,
    textColor: "#fff",
    extendedProps: a,
  };
}

function SetupBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
      <p className="text-amber-800 font-medium">Demo-Modus: Tenant-ID nicht konfiguriert</p>
      <p className="text-amber-600 text-sm mt-1">
        Bitte <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_DEMO_TENANT_ID</code> in{" "}
        <code className="bg-amber-100 px-1 rounded">.env.local</code> setzen.
      </p>
    </div>
  );
}

function TodayPanel({ appointments, onSelect }: { appointments: ApptDetail[]; onSelect: (a: ApptDetail) => void }) {
  const today = new Date();
  const todayAppts = appointments.filter((a) => {
    const d = new Date(a.startTime);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  });
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">
          Heute{" "}
          {todayAppts.length > 0 && (
            <span className="ml-1 text-sm font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{todayAppts.length}</span>
          )}
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">{today.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>
      <div className="divide-y divide-gray-50">
        {todayAppts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Keine Termine heute</p>
        ) : (
          todayAppts.map((a) => (
            <button key={a.id} onClick={() => onSelect(a)} className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-gray-900">{a.patientName ?? "–"}</span>
                <AppointmentStatusBadge status={a.status} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{a.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(a.startTime).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} –{" "}
                {new Date(a.endTime).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type CalView = "timeGridWeek" | "timeGridDay" | "dayGridMonth" | "listWeek";

export default function SchedulePage() {
  const { tenantId, isReady } = useTenant();
  const calRef = useRef<FullCalendarType>(null);
  const [view, setView] = useState<CalView>("timeGridWeek");
  const [currentTitle, setCurrentTitle] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editAppt, setEditAppt] = useState<ApptDetail | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();

  const from = new Date(); from.setMonth(from.getMonth() - 1);
  const to = new Date(); to.setMonth(to.getMonth() + 3);

  const { data: appointments, isLoading, refetch } = trpc.appointments.listWithDetails.useQuery(
    { tenantId: tenantId!, from, to },
    { enabled: !!tenantId }
  );

  const calEvents = (appointments ?? []).map((a) => toCalEvent(a as ApptDetail));

  const nav = (dir: "prev" | "next" | "today") => {
    const api = calRef.current?.getApi();
    if (!api) return;
    dir === "prev" ? api.prev() : dir === "next" ? api.next() : api.today();
    setCurrentTitle(api.view.title);
  };

  const switchView = (v: CalView) => {
    const api = calRef.current?.getApi();
    if (api) { api.changeView(v); setCurrentTitle(api.view.title); }
    setView(v);
  };

  const openNew = (start?: Date) => { setEditAppt(null); setDefaultStart(start ?? new Date()); setModalOpen(true); };
  const openEdit = (a: ApptDetail) => { setEditAppt(a); setDefaultStart(undefined); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditAppt(null); setDefaultStart(undefined); };

  const viewButtons: { key: CalView; label: string }[] = [
    { key: "timeGridDay", label: "Tag" },
    { key: "timeGridWeek", label: "Woche" },
    { key: "dayGridMonth", label: "Monat" },
    { key: "listWeek", label: "Liste" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Terminkalender</h1>
          <p className="text-gray-500 mt-1">{appointments ? `${appointments.length} Termine geladen` : "Terminübersicht"}</p>
        </div>
        <Button onClick={() => openNew()} disabled={!tenantId}>
          <Plus size={16} /> Neuer Termin
        </Button>
      </div>

      {isReady && !tenantId && <SetupBanner />}

      {tenantId && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
          {/* Calendar area */}
          <div className="xl:col-span-3 space-y-4">
            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1">
                <button onClick={() => nav("prev")} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft size={18} /></button>
                <button onClick={() => nav("today")} className="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors">Heute</button>
                <button onClick={() => nav("next")} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight size={18} /></button>
                <span className="font-semibold text-gray-900 ml-2 hidden sm:block">{currentTitle}</span>
              </div>
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                {viewButtons.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => switchView(key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-8 w-full" />
                  {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="p-2">
                  <FullCalendar
                    ref={calRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                    initialView={view}
                    events={calEvents}
                    headerToolbar={false}
                    locale="de"
                    firstDay={1}
                    slotMinTime="07:00:00"
                    slotMaxTime="20:00:00"
                    height="auto"
                    selectable
                    selectMirror
                    nowIndicator
                    allDaySlot={false}
                    eventClick={(info) => openEdit(info.event.extendedProps as ApptDetail)}
                    dateClick={(info) => openNew(new Date(info.date))}
                    select={(info) => openNew(new Date(info.start))}
                    datesSet={(info) => setCurrentTitle(info.view.title)}
                    slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                    eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                    businessHours={{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "18:00" }}
                    noEventsText="Keine Termine in diesem Zeitraum"
                    eventContent={(info) => (
                      <div className="px-1.5 py-0.5 overflow-hidden cursor-pointer">
                        <p className="text-xs font-semibold truncate leading-tight">{info.event.title}</p>
                        <p className="text-[10px] opacity-80">{info.timeText}</p>
                      </div>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 px-1">
              {Object.entries({ scheduled: "Geplant", completed: "Abgeschlossen", cancelled: "Abgesagt", "no-show": "Nicht erschienen" }).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[key]?.bg }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <TodayPanel appointments={(appointments ?? []) as ApptDetail[]} onSelect={openEdit} />
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Nächste Termine</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {(appointments ?? []).filter((a) => new Date(a.startTime) >= new Date()).slice(0, 6).map((a) => (
                  <button key={a.id} onClick={() => openEdit(a as ApptDetail)} className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors">
                    <p className="text-xs font-medium text-gray-900 truncate">{a.patientName ?? "–"} — {a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.startTime).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </button>
                ))}
                {!appointments?.filter((a) => new Date(a.startTime) >= new Date()).length && (
                  <p className="text-sm text-gray-400 text-center py-6">Keine Termine</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tenantId && (
        <AppointmentModal
          open={modalOpen}
          onClose={closeModal}
          tenantId={tenantId}
          onSuccess={() => refetch()}
          editData={editAppt ? {
            id: editAppt.id, title: editAppt.title, description: editAppt.description,
            startTime: new Date(editAppt.startTime), endTime: new Date(editAppt.endTime),
            status: editAppt.status, patientId: editAppt.patientId, vetId: editAppt.vetId,
            patientName: editAppt.patientName,
          } : undefined}
          defaultStart={defaultStart}
        />
      )}
    </div>
  );
}
