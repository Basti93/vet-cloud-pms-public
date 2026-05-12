"use client";

import Link from "next/link";
import { Calendar, Users, Phone, ArrowRight, CheckCircle, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentVet } from "@/hooks/useCurrentVet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusTooltip } from "@/components/ui/status-tooltip";
import { AppointmentModal } from "@/components/appointments/AppointmentModal";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { AppointmentTable } from "@/components/appointments/AppointmentTable";
import { TrialWarningBanner } from "@/components/subscription/TrialWarningBanner";
import type { AppointmentType } from "@/components/appointments/AppointmentTable";
import { useState, useMemo } from "react";

function StatCard({
  label,
  value,
  icon,
  loading,
  description,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  loading?: boolean;
  description?: string;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          {description && <p className="text-xs text-muted mt-1">{description}</p>}
        </div>
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "var(--color-accent-soft)", color: "var(--color-accent)" }}
        >
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-16" />
      ) : (
        <p className="text-3xl font-bold text-fg">{value}</p>
      )}
    </div>
  );
}

export default function DashboardHome() {
  type EditableAppointment = {
    id: string;
    title: string;
    description: string | null;
    startTime: Date | string;
    endTime: Date | string;
    status: string;
    patientId: string;
    vetId: string;
    patientName?: string | null;
  };
  type EditableSource = AppointmentType & {
    title: string;
    patientId: string;
    description?: string | null;
    patientName?: string | null;
  };
  const { tenantId } = useTenant();
  const vetId = useCurrentVet();
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentType | null>(null);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const { data: currentUser } = trpc.admin.getCurrentUser.useQuery();

  const { today, todayStart, todayEnd, monthStart, monthEnd, upcomingEnd } = useMemo(() => {
    const today = new Date();
    // Today: from 00:00:00 to 23:59:59
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    // Month: from 1st to last day (inclusive)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    // Upcoming: next 7 days
    const upcomingEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7, 23, 59, 59, 999);
    return { today, todayStart, todayEnd, monthStart, monthEnd, upcomingEnd };
  }, []);

  const { data: patients, refetch: refetchPatients } = trpc.patients.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId }
  );
  const { data: allAppts, refetch: refetchAppts } = trpc.appointments.listWithDetails.useQuery(
    { tenantId: tenantId!, from: monthStart, to: monthEnd },
    { enabled: !!tenantId }
  );
  const { data: upcomingAppts, isLoading: upcomingLoading, refetch: refetchUpcomingAppts } = trpc.appointments.listWithDetails.useQuery(
    { tenantId: tenantId!, from: today, to: upcomingEnd },
    { enabled: !!tenantId }
  );
  const { data: vets } = trpc.vet.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId }
  );
  const { data: subscriptionStatus } = trpc.subscriptions.getSubscriptionStatus.useQuery(
    undefined,
    { enabled: !!tenantId }
  );

  const todayAppts = allAppts?.filter((a) => {
    const d = new Date(a.startTime);
    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayDate = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate());
    return dDate.getTime() === todayDate.getTime() && (!vetId || a.vetId === vetId);
  }) ?? [];

  const completedThisMonth = allAppts?.filter(
    (a) => a.status === "completed" && (!vetId || a.vetId === vetId)
  ).length ?? 0;

  const isLoading = !tenantId;

  const isEditableSource = (item: AppointmentType): item is EditableSource =>
    "title" in item && "patientId" in item && typeof item.patientId === "string";

  const toEditableAppointment = (item: AppointmentType | null): EditableAppointment | null => {
    if (!item) return null;
    if (!isEditableSource(item)) return null;

    return {
      id: item.id,
      title: item.title,
      description: item.description ?? null,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status,
      patientId: item.patientId,
      vetId: item.vetId,
      patientName: item.patientName ?? null,
    };
  };

  return (
    <div data-testid="dashboard-home" className="space-y-6">
      <TrialWarningBanner daysUntilTrialEnds={subscriptionStatus?.daysUntilTrialEnds || null} />

      <div>
        <h1 className="text-3xl font-bold text-fg">
          Hallo {currentUser?.firstName || "Willkommen"}!
        </h1>
        <p className="text-muted mt-1">
          {today.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Termine heute"
          value={todayAppts.length}
          icon={<Calendar size={18} />}
          loading={isLoading}
          description={vetId ? "Nur meine Termine" : "Alle Tierärzte"}
        />
        <StatCard
          label="Patienten gesamt"
          value={patients?.length ?? 0}
          icon={<Users size={18} />}
          loading={isLoading}
          description="Alle Patienten der Praxis"
        />
        <StatCard
          label="Abgeschlossen (Monat)"
          value={completedThisMonth}
          icon={<CheckCircle size={18} />}
          loading={isLoading}
          description={vetId ? "Nur meine" : "Alle Tierärzte"}
        />
        <StatCard
          label="Termine (Monat)"
          value={allAppts?.length ?? 0}
          icon={<TrendingUp size={18} />}
          loading={isLoading}
          description={vetId ? "Nur meine Termine" : "Alle Tierärzte"}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Upcoming appointments */}
        <div className="xl:col-span-2 bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-bold text-fg">Nächste Termine</h2>
              <p className="text-xs text-muted mt-1">Alle bestätigten Termine (inkl. Online-Buchungen)</p>
            </div>
            <Link
              href="/dashboard/schedule"
              className="text-sm font-medium flex items-center gap-1"
              style={{ color: "var(--color-accent)" }}
            >
              Kalender <ArrowRight size={14} />
            </Link>
          </div>
          <div className="p-6">
            <AppointmentTable
              items={(upcomingAppts ?? []).filter((a) => !vetId || a.vetId === vetId)}
              vets={vets ?? []}
              compact={true}
              loading={upcomingLoading}
              todayStart={todayStart}
              todayEnd={todayEnd}
              showActions={false}
              onAppointmentClick={(item) => {
                setSelectedAppointment(item);
                setApptModalOpen(true);
              }}
            />
          </div>
        </div>

        <div className="space-y-4">
          {/* Quick actions */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
            <h2 className="font-bold text-fg mb-4">Schnellaktionen</h2>
            <div className="space-y-3">
              <button
                onClick={() => setApptModalOpen(true)}
                disabled={!tenantId}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl transition-all text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md hover:scale-105 active:scale-95"
                style={{ backgroundColor: "var(--color-accent-soft)" }}
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "var(--color-accent)", color: "white" }}
                >
                  <Calendar size={16} />
                </span>
                <div>
                  <p className="font-semibold text-sm text-fg">Neuer Termin</p>
                  <p className="text-xs text-muted mt-0.5">Termin direkt anlegen</p>
                </div>
              </button>

              <button
                onClick={() => setPatientModalOpen(true)}
                disabled={!tenantId}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl transition-all text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md hover:scale-105 active:scale-95"
                style={{ backgroundColor: "var(--color-accent-soft)" }}
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "var(--color-accent)", color: "white" }}
                >
                  <Users size={16} />
                </span>
                <div>
                  <p className="font-semibold text-sm text-fg">Neuer Patient</p>
                  <p className="text-xs text-muted mt-0.5">Neue Tierkarte erstellen</p>
                </div>
              </button>

              <Link
                href="/dashboard/voice"
                className="w-full flex items-center gap-3 p-3.5 rounded-xl transition-all cursor-pointer hover:shadow-md hover:scale-105 active:scale-95 block"
                style={{ backgroundColor: "var(--color-accent-soft)" }}
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "var(--color-accent)", color: "white" }}
                >
                  <Phone size={16} />
                </span>
                <div>
                  <p className="font-semibold text-sm text-fg">AI-Rezeption</p>
                  <p className="text-xs text-muted mt-0.5">Voice Demo starten</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Today summary */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold text-fg text-sm">Heute im Überblick</h3>
              <StatusTooltip />
            </div>
            <div className="space-y-2.5">
              {[
                ["Geplant", todayAppts.filter((a) => a.status === "scheduled").length, "#2563eb"],
                ["Bestätigt", todayAppts.filter((a) => a.status === "confirmed").length, "#10b981"],
                ["Abgeschlossen", todayAppts.filter((a) => a.status === "completed").length, "#16a34a"],
                ["Abgesagt", todayAppts.filter((a) => a.status === "cancelled").length, "#dc2626"],
                ["Nicht erschienen", todayAppts.filter((a) => a.status === "no-show").length, "#d97706"],
              ].map(([label, val, color]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-muted">{label}</span>
                  <span className="font-semibold" style={{ color: color as string }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {tenantId && (
        <>
          <AppointmentModal
            open={apptModalOpen}
            onClose={() => {
              setApptModalOpen(false);
              setSelectedAppointment(null);
            }}
            tenantId={tenantId}
            onSuccess={() => {
              refetchAppts();
              refetchUpcomingAppts();
              setApptModalOpen(false);
              setSelectedAppointment(null);
            }}
            editData={(() => {
              const editable = toEditableAppointment(selectedAppointment);
              if (!editable) return undefined;
              return {
                id: editable.id,
                title: editable.title,
                description: editable.description || null,
                startTime: new Date(editable.startTime),
                endTime: new Date(editable.endTime),
                status: editable.status,
                patientId: editable.patientId,
                vetId: editable.vetId,
                patientName: editable.patientName,
              };
            })()}
          />
          <NewPatientModal
            open={patientModalOpen}
            onClose={() => setPatientModalOpen(false)}
            tenantId={tenantId}
            onSuccess={() => refetchPatients()}
          />
        </>
      )}
    </div>
  );
}
