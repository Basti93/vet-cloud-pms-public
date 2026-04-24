"use client";

import { useState, useMemo } from "react";
import { Calendar, TrendingUp, Users, CheckCircle, Activity } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({
  label,
  value,
  icon,
  loading,
  unit,
  highlight,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  loading?: boolean;
  unit?: string;
  highlight?: "success" | "warning" | "danger";
  hint?: string;
}) {
  const getHighlightColor = () => {
    if (highlight === "success") return "#16a34a";
    if (highlight === "warning") return "#d97706";
    if (highlight === "danger") return "#dc2626";
    return "var(--color-accent)";
  };

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 group cursor-help relative">
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
        <Skeleton className="h-9 w-24" />
      ) : (
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold" style={{ color: getHighlightColor() }}>
            {value}
          </p>
          {unit && <p className="text-sm text-muted">{unit}</p>}
        </div>
      )}
      {hint && (
        <p className="text-xs text-muted mt-3 group-hover:text-fg transition-colors">
          💡 {hint}
        </p>
      )}
    </div>
  );
}

function TimePeriodSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (period: string) => void;
}) {
  const periods = [
    { id: "week", label: "Diese Woche" },
    { id: "month", label: "Dieser Monat" },
    { id: "year", label: "Dieses Jahr" },
  ];

  return (
    <div className="flex gap-2">
      {periods.map((period) => (
        <button
          key={period.id}
          onClick={() => onChange(period.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            selected === period.id
              ? "text-white"
              : "bg-surface border border-border text-fg hover:bg-bg"
          }`}
          style={
            selected === period.id
              ? { backgroundColor: "var(--color-accent)" }
              : undefined
          }
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

export default function StatisticsPage() {
  const { tenantId } = useTenant();
  const [selectedPeriod, setSelectedPeriod] = useState("month");

  const now = new Date();
  const { from, to } = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (selectedPeriod === "week") {
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek;
      const from = new Date(today.getFullYear(), today.getMonth(), diff);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      return { from, to };
    }

    if (selectedPeriod === "month") {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to = new Date(from);
      to.setMonth(to.getMonth() + 1);
      return { from, to };
    }

    // year
    const from = new Date(today.getFullYear(), 0, 1);
    const to = new Date(from);
    to.setFullYear(to.getFullYear() + 1);
    return { from, to };
  }, [selectedPeriod]);

  const { data: metrics, isLoading: metricsLoading } = trpc.statistics.getMetrics.useQuery(
    { tenantId: tenantId || "", from, to },
    { enabled: !!tenantId }
  );

  const { data: trend, isLoading: trendLoading } = trpc.statistics.getTrendData.useQuery(
    { tenantId: tenantId || "", from, to, groupBy: "day" },
    { enabled: !!tenantId }
  );

  const { data: vetUtilization, isLoading: vetLoading } = trpc.statistics.getVetUtilization.useQuery(
    { tenantId: tenantId || "", from, to },
    { enabled: !!tenantId }
  );

  const { data: statusDist, isLoading: statusLoading } = trpc.statistics.getStatusDistribution.useQuery(
    { tenantId: tenantId || "", from, to },
    { enabled: !!tenantId }
  );

  const { data: sources, isLoading: sourcesLoading } = trpc.statistics.getSourceComparison.useQuery(
    { tenantId: tenantId || "", from, to },
    { enabled: !!tenantId }
  );

  const isLoading = !tenantId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-fg">Statistiken</h1>
          <p className="text-muted mt-1">Überblick über Praxisleistung und Trends</p>
          <p className="text-sm text-muted mt-2 max-w-2xl">
            Verfolgen Sie wichtige Kennzahlen wie Abschlussquoten, Auslastung und Patientenwachstum.
            Wählen Sie einen Zeitraum, um Trends zu analysieren und datengestützte Entscheidungen zu treffen.
          </p>
        </div>
        <TimePeriodSelector selected={selectedPeriod} onChange={setSelectedPeriod} />
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Termine gesamt"
          value={metrics?.totalAppointments ?? 0}
          icon={<Calendar size={18} />}
          loading={isLoading || metricsLoading}
          hint="Gesamtanzahl aller Termine im ausgewählten Zeitraum"
        />
        <StatCard
          label="Erfolgsquote"
          value={metrics?.completionRate ?? 0}
          unit="%"
          icon={<CheckCircle size={18} />}
          loading={isLoading || metricsLoading}
          highlight="success"
          hint="Anteil abgeschlossener Termine (Status: abgeschlossen)"
        />
        <StatCard
          label="Nicht erschienen"
          value={metrics?.noShowRate ?? 0}
          unit="%"
          icon={<Activity size={18} />}
          loading={isLoading || metricsLoading}
          highlight={metrics && metrics.noShowRate > 10 ? "danger" : "warning"}
          hint="Anteil Patienten die nicht erschienen sind"
        />
        <StatCard
          label="Online-Conversion"
          value={metrics?.onlineConversionRate ?? 0}
          unit="%"
          icon={<TrendingUp size={18} />}
          loading={isLoading || metricsLoading}
          highlight="success"
          hint="Anteil bestätigter Online-Buchungen"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          label="Neue Patienten"
          value={metrics?.newPatients ?? 0}
          icon={<Users size={18} />}
          loading={isLoading || metricsLoading}
          hint="Anzahl neuer Patienten in diesem Zeitraum"
        />
        <StatCard
          label="Rückkehrer"
          value={metrics?.returningRate ?? 0}
          unit="%"
          icon={<Users size={18} />}
          loading={isLoading || metricsLoading}
          hint="Anteil Patienten mit 2+ Terminen"
        />
        <StatCard
          label="Email-Versand"
          value={metrics?.emailDeliveryRate ?? 0}
          unit="%"
          icon={<CheckCircle size={18} />}
          loading={isLoading || metricsLoading}
          hint="Erfolgsquote versendeter Erinnerungen"
        />
        <StatCard
          label="Voice AI Bookings"
          value={metrics?.voiceAIBookings ?? 0}
          icon={<Activity size={18} />}
          loading={isLoading || metricsLoading}
          hint="Termine gebucht über AI-Rezeption"
        />
        <StatCard
          label="Ø Dauer"
          value={metrics?.avgDuration ?? 0}
          unit="min"
          icon={<Calendar size={18} />}
          loading={isLoading || metricsLoading}
          hint="Durchschnittliche Termin-Dauer"
        />
      </div>

      {/* Vet Utilization */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
        <h2 className="text-xl font-bold text-fg mb-4">Ärzte - Auslastung</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold text-fg">Name</th>
                <th className="text-center py-3 px-4 font-semibold text-fg">Termine</th>
                <th className="text-center py-3 px-4 font-semibold text-fg">Auslastung</th>
              </tr>
            </thead>
            <tbody>
              {vetLoading ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ) : vetUtilization && vetUtilization.length > 0 ? (
                vetUtilization.map((vet) => (
                  <tr key={vet.vetId} className="border-b border-border hover:bg-bg transition">
                    <td className="py-3 px-4 text-fg">{vet.name}</td>
                    <td className="text-center py-3 px-4 text-fg font-medium">{vet.appointments}</td>
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-32 bg-border rounded-full h-2">
                          <div
                            className="bg-accent h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.min(vet.utilization, 100)}%`,
                              backgroundColor: "var(--color-accent)",
                            }}
                          />
                        </div>
                        <span
                          className="text-sm font-semibold"
                          style={{
                            color:
                              vet.utilization > 80
                                ? "#dc2626"
                                : vet.utilization > 60
                                  ? "#d97706"
                                  : "#16a34a",
                          }}
                        >
                          {vet.utilization}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted">
                    Keine Daten verfügbar
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
          <h2 className="text-xl font-bold text-fg mb-4">Buchungsquellen</h2>
          <div className="space-y-3">
            {sourcesLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : sources && sources.length > 0 ? (
              sources.map((source) => (
                <div key={source.source} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-fg font-medium capitalize">{source.source.replace("_", " ")}</span>
                    <span className="text-muted">{source.total} Termine</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-2">
                    <div
                      className="bg-accent h-2 rounded-full transition-all"
                      style={{
                        width: `${(source.total / (sources.reduce((a, b) => a + b.total, 0) || 1)) * 100}%`,
                        backgroundColor: "var(--color-accent)",
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted">Erfolgsquote: {source.completionRate}%</span>
                </div>
              ))
            ) : (
              <p className="text-muted text-sm">Keine Daten verfügbar</p>
            )}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
          <h2 className="text-xl font-bold text-fg mb-4">Terminstatus</h2>
          <div className="space-y-3">
            {statusLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : statusDist && statusDist.length > 0 ? (
              statusDist.map((status) => {
                const statusLabels: Record<string, string> = {
                  scheduled: "Geplant",
                  confirmed: "Bestätigt",
                  completed: "Abgeschlossen",
                  cancelled: "Abgesagt",
                  "no-show": "Nicht erschienen",
                };

                const statusColors: Record<string, string> = {
                  scheduled: "#2563eb",
                  confirmed: "#8b5cf6",
                  completed: "#16a34a",
                  cancelled: "#dc2626",
                  "no-show": "#d97706",
                };

                return (
                  <div key={status.status} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-fg font-medium">{statusLabels[status.status]}</span>
                      <span className="text-muted">{status.count} Termine</span>
                    </div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${(status.count / (statusDist.reduce((a, b) => a + b.count, 0) || 1)) * 100}%`,
                          backgroundColor: statusColors[status.status],
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-muted text-sm">Keine Daten verfügbar</p>
            )}
          </div>
        </div>
      </div>

      {/* Trend */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
        <h2 className="text-xl font-bold text-fg mb-4">Trend</h2>
        {trendLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : trend && trend.length > 0 ? (
          <div className="text-sm text-muted text-center py-12">
            Einfaches Trend-Dashboard mit {trend.length} Datenpunkten
            <p className="text-xs mt-2">
              {trend[0].period} bis {trend[trend.length - 1].period}
            </p>
            <div className="mt-4 space-y-2 text-left max-w-2xl mx-auto">
              {trend.slice(-7).map((point) => (
                <div key={point.period} className="flex justify-between text-sm">
                  <span className="font-medium">{point.period}</span>
                  <span>
                    {point.count} Termine ({point.completionRate}% erfolg)
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted text-center py-12">Keine Trend-Daten verfügbar</p>
        )}
      </div>
    </div>
  );
}
