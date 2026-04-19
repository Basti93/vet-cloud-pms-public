"use client";

import Link from "next/link";
import { Calendar, Users, Phone, ArrowRight, CheckCircle, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentVet } from "@/hooks/useCurrentVet";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentModal } from "@/components/appointments/AppointmentModal";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { AppointmentTable } from "@/components/appointments/AppointmentTable";
import { useState, useMemo } from "react";

function StatCard({
  label,
  value,
  icon,
  loading,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-muted">{label}</p>
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
  const { tenantId } = useTenant();
  const vetId = useCurrentVet();
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [patientModalOpen, setPatientModalOpen] = useState(false);

  const { today, todayStart, todayEnd, monthStart, monthEnd, upcomingEnd } = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const upcomingEnd = new Date(today.getTime() + 7 * 86_400_000);
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
  const { data: upcomingAppts, isLoading: upcomingLoading } = trpc.appointments.listWithDetails.useQuery(
    { tenantId: tenantId!, from: today, to: upcomingEnd },
    { enabled: !!tenantId }
  );
  const { data: vets } = trpc.vet.list.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId }
  );

  const todayAppts = allAppts?.filter((a) => {
    const d = new Date(a.startTime);
    return d >= todayStart && d < todayEnd && (!vetId || a.vetId === vetId);
  }) ?? [];

  const completedThisMonth = allAppts?.filter(
    (a) => a.status === "completed" && (!vetId || a.vetId === vetId)
  ).length ?? 0;

  const next5 = (upcomingAppts ?? [])
    .filter((a) => new Date(a.startTime) >= today && (!vetId || a.vetId === vetId))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  const isLoading = !tenantId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-fg">Übersicht</h1>
        <p className="text-muted mt-1">
          {today.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Termine heute" value={todayAppts.length} icon={<Calendar size={18} />} loading={isLoading} />
        <StatCard label="Patienten gesamt" value={patients?.length ?? 0} icon={<Users size={18} />} loading={isLoading} />
        <StatCard label="Abgeschlossen (Monat)" value={completedThisMonth} icon={<CheckCircle size={18} />} loading={isLoading} />
        <StatCard label="Termine (Monat)" value={allAppts?.length ?? 0} icon={<TrendingUp size={18} />} loading={isLoading} />
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
                className="w-full flex items-center gap-3 p-3.5 rounded-xl transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
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
                className="w-full flex items-center gap-3 p-3.5 rounded-xl transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
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
                className="w-full flex items-center gap-3 p-3.5 rounded-xl transition-colors hover:opacity-90"
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
            <h3 className="font-semibold text-fg text-sm mb-3">Heute im Überblick</h3>
            <div className="space-y-2.5">
              {[
                ["Geplant", todayAppts.filter((a) => a.status === "scheduled").length, "#2563eb"],
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
            onClose={() => setApptModalOpen(false)}
            tenantId={tenantId}
            onSuccess={() => refetchAppts()}
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
