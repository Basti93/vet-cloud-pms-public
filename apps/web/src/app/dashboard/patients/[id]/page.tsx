"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, Weight,
  Edit2, Plus, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentStatusBadge, SpeciesIcon } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentModal } from "@/components/appointments/AppointmentModal";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", {
    weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function calcAge(birthDate: Date | string | null | undefined) {
  if (!birthDate) return null;
  const ms = Date.now() - new Date(birthDate).getTime();
  const years = Math.floor(ms / (1000 * 60 * 60 * 24 * 365.25));
  const months = Math.floor((ms % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
  if (years > 0) return `${years} Jahr${years !== 1 ? "e" : ""}${months > 0 ? ` ${months} Mo.` : ""}`;
  return `${months} Monat${months !== 1 ? "e" : ""}`;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-900 mt-0.5">{value ?? "—"}</p>
      </div>
    </div>
  );
}

function AppointmentItem({ appt }: {
  appt: { id: string; title: string; startTime: Date; status: string; description: string | null };
}) {
  const isPast = new Date(appt.startTime) < new Date();
  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border ${isPast ? "border-gray-100 bg-gray-50" : "border-blue-100 bg-blue-50/50"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPast ? "bg-gray-200" : "bg-blue-100"}`}>
        <Calendar size={18} className={isPast ? "text-gray-500" : "text-blue-600"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-gray-900 text-sm">{appt.title}</p>
          <AppointmentStatusBadge status={appt.status} />
        </div>
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <Clock size={11} /> {formatDateTime(appt.startTime)}
        </p>
        {appt.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{appt.description}</p>}
      </div>
    </div>
  );
}

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { tenantId } = useTenant();
  const [apptModalOpen, setApptModalOpen] = useState(false);

  const { data, isLoading } = trpc.patients.byId.useQuery({ id }, { enabled: !!id });
  const { data: appointments, isLoading: apptLoading, refetch: refetchAppts } = trpc.appointments.listWithDetails.useQuery(
    { tenantId: tenantId! },
    { enabled: !!tenantId }
  );

  const patientAppts = appointments?.filter((a) => a.patientId === id) ?? [];
  const upcoming = patientAppts.filter((a) => new Date(a.startTime) >= new Date());
  const past = patientAppts.filter((a) => new Date(a.startTime) < new Date());

  // Drizzle join returns { patients: {...}, owners: {...} } or flat if select()
  const raw = data as any;
  const pat = raw?.patients ?? raw;
  const own = raw?.owners ?? raw;

  const name = pat?.name;
  const species = pat?.species;
  const breed = pat?.breed;
  const birthDate = pat?.birthDate;
  const weight = pat?.weight;
  const microchip = pat?.microchipId;
  const notes = pat?.notes;

  const ownerFirst = own?.firstName ?? raw?.ownerFirstName;
  const ownerLast = own?.lastName ?? raw?.ownerLastName;
  const ownerEmail = own?.email ?? raw?.ownerEmail;
  const ownerPhone = own?.phone ?? raw?.ownerPhone;
  const ownerAddress = own?.address;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/patients"><Button variant="ghost" size="sm"><ArrowLeft size={16} /> Zurück</Button></Link>
          <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32" /></div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Patient nicht gefunden</p>
        <Link href="/dashboard/patients"><Button variant="outline" className="mt-4">Zurück zur Liste</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/dashboard/patients">
          <Button variant="ghost" size="sm"><ArrowLeft size={16} /> Zurück</Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center text-2xl">
            <SpeciesIcon species={species} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
            <p className="text-gray-500 text-sm">
              {species}{breed ? ` · ${breed}` : ""}{birthDate ? ` · ${calcAge(birthDate)}` : ""}
            </p>
          </div>
        </div>
        <Button onClick={() => setApptModalOpen(true)} disabled={!tenantId}>
          <Plus size={16} /> Neuer Termin
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Info */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-lg">Patienten-Daten</h2>
              <Button variant="ghost" size="sm"><Edit2 size={14} /> Bearbeiten</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <InfoRow icon={<Calendar size={15} />} label="Geburtsdatum" value={formatDate(birthDate)} />
              <InfoRow icon={<Weight size={15} />} label="Gewicht" value={weight ? `${(weight / 1000).toFixed(1)} kg` : null} />
              {microchip && <InfoRow icon={<span className="text-sm">💾</span>} label="Microchip-Nr." value={microchip} />}
            </div>
            {notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Notizen</p>
                <p className="text-sm text-gray-700">{notes}</p>
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-lg">
                Nächste Termine
                {upcoming.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{upcoming.length}</span>
                )}
              </h2>
              <Button variant="outline" size="sm" onClick={() => setApptModalOpen(true)} disabled={!tenantId}>
                <Plus size={14} /> Termin
              </Button>
            </div>
            {apptLoading ? (
              <div className="space-y-3"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Keine anstehenden Termine</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((a) => <AppointmentItem key={a.id} appt={{ id: a.id, title: a.title, startTime: a.startTime, status: a.status, description: a.description ?? null }} />)}
              </div>
            )}
          </div>

          {/* Past */}
          {past.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Vorherige Termine <span className="text-sm font-normal text-gray-500">({past.length})</span></h2>
              <div className="space-y-3">
                {past.map((a) => <AppointmentItem key={a.id} appt={{ id: a.id, title: a.title, startTime: a.startTime, status: a.status, description: a.description ?? null }} />)}
              </div>
            </div>
          )}
        </div>

        {/* Right — Owner */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Halter</h2>
              <Button variant="ghost" size="sm"><Edit2 size={14} /></Button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center font-semibold text-gray-500">
                {ownerFirst?.[0]}{ownerLast?.[0]}
              </div>
              <p className="font-semibold text-gray-900">{ownerFirst} {ownerLast}</p>
            </div>
            <div className="space-y-3">
              {ownerPhone && (
                <a href={`tel:${ownerPhone}`} className="flex items-center gap-3 text-sm text-gray-700 hover:text-blue-600 transition-colors">
                  <span className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0"><Phone size={14} className="text-green-600" /></span>
                  {ownerPhone}
                </a>
              )}
              {ownerEmail && (
                <a href={`mailto:${ownerEmail}`} className="flex items-center gap-3 text-sm text-gray-700 hover:text-blue-600 transition-colors">
                  <span className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0"><Mail size={14} className="text-blue-600" /></span>
                  {ownerEmail}
                </a>
              )}
              {ownerAddress && (
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"><MapPin size={14} className="text-gray-500" /></span>
                  {ownerAddress}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Übersicht</h3>
            <div className="space-y-3">
              {[
                ["Termine gesamt", patientAppts.length, ""],
                ["Abgeschlossen", patientAppts.filter((a) => a.status === "completed").length, "text-green-600"],
                ["Letzter Besuch", past[0] ? formatDate(past[0].startTime) : "—", ""],
              ].map(([label, value, cls]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className={`font-semibold ${cls}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {tenantId && (
        <AppointmentModal
          open={apptModalOpen}
          onClose={() => setApptModalOpen(false)}
          tenantId={tenantId}
          onSuccess={() => refetchAppts()}
          preselectedPatientId={id}
        />
      )}
    </div>
  );
}
