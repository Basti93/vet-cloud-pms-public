"use client";

import Link from "next/link";
import { Calendar, Users, Phone, ArrowRight, CheckCircle, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentModal } from "@/components/appointments/AppointmentModal";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { AppointmentTable } from "@/components/appointments/AppointmentTable";
import { useState, useMemo } from "react";

function StatCard({
  label,
  value,
  icon,
  color,
  loading,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="h-9 w-16" />
      ) : (
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      )}
    </div>
  );
}

export default function DashboardHome() {
  const { tenantId } = useTenant();
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [patientModalOpen, setPatientModalOpen] = useState(false);

  // ✅ FIX: Memoize all date ranges to prevent infinite refetch loops
  const { today, todayStart, todayEnd, monthStart, monthEnd, upcomingEnd } = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const upcomingEnd = new Date(today.getTime() + 7 * 86_400_000);
    return { today, todayStart, todayEnd, monthStart, monthEnd, upcomingEnd };
  }, []); // Empty deps = created once on mount, never changes

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
    return d >= todayStart && d < todayEnd;
  }) ?? [];

  const completedThisMonth = allAppts?.filter((a) => a.status === "completed").length ?? 0;

  const next5 = (upcomingAppts ?? [])
    .filter((a) => new Date(a.startTime) >= today)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  const isLoading = !tenantId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Übersicht</h1>
        <p className="text-gray-500 mt-1">
          {today.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Termine heute"
          value={todayAppts.length}
          icon={<Calendar size={18} className="text-blue-600" />}
          color="bg-blue-50"
          loading={isLoading}
        />
        <StatCard
          label="Patienten gesamt"
          value={patients?.length ?? 0}
          icon={<Users size={18} className="text-indigo-600" />}
          color="bg-indigo-50"
          loading={isLoading}
        />
        <StatCard
          label="Abgeschlossen (Monat)"
          value={completedThisMonth}
          icon={<CheckCircle size={18} className="text-green-600" />}
          color="bg-green-50"
          loading={isLoading}
        />
        <StatCard
          label="Termine (Monat)"
          value={allAppts?.length ?? 0}
          icon={<TrendingUp size={18} className="text-amber-600" />}
          color="bg-amber-50"
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Upcoming appointments */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900">Nächste Termine</h2>
              <p className="text-xs text-gray-500 mt-1">Alle bestätigten Termine (incl. Online-Buchungen)</p>
            </div>
            <Link href="/dashboard/schedule" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
              Kalender <ArrowRight size={14} />
            </Link>
          </div>
          <div className="p-6">
            <AppointmentTable
              items={upcomingAppts ?? []}
              vets={vets ?? []}
              compact={true}
              loading={upcomingLoading}
              todayStart={todayStart}
              todayEnd={todayEnd}
              showActions={false}
            />
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4">Schnellaktionen</h2>
            <div className="space-y-3">
              <button
                onClick={() => setApptModalOpen(true)}
                disabled={!tenantId}
                className="w-full flex items-center gap-3 p-3.5 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-blue-600" />
                </span>
                <div>
                  <p className="font-semibold text-blue-900 text-sm">Neuer Termin</p>
                  <p className="text-xs text-blue-600 mt-0.5">Termin direkt anlegen</p>
                </div>
              </button>

              <button
                onClick={() => setPatientModalOpen(true)}
                disabled={!tenantId}
                className="w-full flex items-center gap-3 p-3.5 bg-green-50 rounded-xl hover:bg-green-100 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users size={16} className="text-green-600" />
                </span>
                <div>
                  <p className="font-semibold text-green-900 text-sm">Neuer Patient</p>
                  <p className="text-xs text-green-600 mt-0.5">Neue Tierkarte erstellen</p>
                </div>
              </button>

              <Link
                href="/dashboard/voice"
                className="w-full flex items-center gap-3 p-3.5 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors text-left"
              >
                <span className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone size={16} className="text-purple-600" />
                </span>
                <div>
                  <p className="font-semibold text-purple-900 text-sm">AI-Rezeption</p>
                  <p className="text-xs text-purple-600 mt-0.5">Voice Demo starten</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Today summary */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Heute im Überblick</h3>
            <div className="space-y-2.5">
              {[
                ["Geplant", todayAppts.filter((a) => a.status === "scheduled").length, "text-blue-600"],
                ["Abgeschlossen", todayAppts.filter((a) => a.status === "completed").length, "text-green-600"],
                ["Abgesagt", todayAppts.filter((a) => a.status === "cancelled").length, "text-red-500"],
                ["Nicht erschienen", todayAppts.filter((a) => a.status === "no-show").length, "text-amber-500"],
              ].map(([label, val, cls]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className={`font-semibold ${cls}`}>{val}</span>
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
