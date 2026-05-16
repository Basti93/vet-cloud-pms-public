"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, ChevronRight, Phone, PawPrint, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpeciesIcon } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";

function SetupBanner() {
  return (
    <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: "#fefce8", border: "1px solid #fde68a" }}>
      <p className="font-medium" style={{ color: "#92400e" }}>Demo-Modus: Tenant-ID noch nicht konfiguriert</p>
      <p className="text-sm mt-1" style={{ color: "#b45309" }}>
        Nach <code className="px-1 rounded" style={{ backgroundColor: "#fef3c7" }}>npm run db:seed</code> bitte{" "}
        <code className="px-1 rounded" style={{ backgroundColor: "#fef3c7" }}>NEXT_PUBLIC_DEMO_TENANT_ID</code> in{" "}
        <code className="px-1 rounded" style={{ backgroundColor: "#fef3c7" }}>.env.local</code> setzen.
      </p>
    </div>
  );
}

function PatientRow({
  patient,
}: {
  patient: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    active: boolean;
    ownerFirstName: string | null;
    ownerLastName: string | null;
    ownerPhone: string | null;
    birthDate: Date | null;
  };
}) {
  const age = patient.birthDate
    ? Math.floor(
        (Date.now() - new Date(patient.birthDate).getTime()) /
          (1000 * 60 * 60 * 24 * 365.25)
      )
    : null;

  return (
    <Link
      href={`/dashboard/patients/${patient.id}`}
      className="flex items-center gap-4 px-6 py-4 hover:bg-muted-soft transition-colors group border-b border-border last:border-0"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: "var(--color-accent-soft)", color: "var(--color-accent)" }}
      >
        <SpeciesIcon species={patient.species} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-fg">{patient.name}</span>
          {!patient.active && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted-soft text-muted">Inaktiv</span>
          )}
        </div>
        <p className="text-sm text-muted mt-0.5">
          {patient.species}
          {patient.breed ? ` · ${patient.breed}` : ""}
          {age !== null ? ` · ${age} J.` : ""}
        </p>
      </div>
      <div className="hidden md:block flex-1 min-w-0">
        <p className="text-sm font-medium text-fg truncate">
          {patient.ownerFirstName} {patient.ownerLastName}
        </p>
        {patient.ownerPhone && (
          <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
            <Phone size={11} /> {patient.ownerPhone}
          </p>
        )}
      </div>
      <ChevronRight size={16} className="text-muted group-hover:text-primary transition-colors flex-shrink-0" />
    </Link>
  );
}

export default function PatientsPage() {
  const { tenantId, isReady } = useTenant();
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);

  const { data, isLoading, refetch } = trpc.patients.list.useQuery(
    { tenantId: tenantId!, search: search || undefined },
    { enabled: !!tenantId }
  );

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/clients"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        <Users size={16} /> Zu den Tierhaltern
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-fg">Patienten</h1>
          <p className="text-muted mt-1">
            {data ? `${data.length} Patienten` : "Alle Tierpatienten Ihrer Praxis"}
          </p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus size={16} /> Neuer Patient
        </Button>
      </div>

      {isReady && !tenantId && <SetupBanner />}

      {tenantId && (
        <Input
          placeholder="Patient oder Halter suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={16} />}
          className="max-w-sm"
        />
      )}

      {tenantId && (
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-[2.5rem_1fr_1fr_1.5rem] gap-4 px-6 py-3 bg-bg border-b border-border text-xs font-semibold text-muted uppercase tracking-wide">
            <div /><div>Patient</div><div>Halter</div><div />
          </div>

          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : !data?.length ? (
            <div className="py-20 text-center text-muted">
              <div className="flex justify-center mb-4" style={{ color: "var(--color-accent)" }}>
                <PawPrint size={48} strokeWidth={1.5} />
              </div>
              <p className="font-medium">
                {search ? `Keine Ergebnisse für „${search}"` : "Noch keine Patienten angelegt"}
              </p>
              {!search && (
                <Button className="mt-4" onClick={() => setShowNewModal(true)}>
                  <Plus size={16} /> Ersten Patienten anlegen
                </Button>
              )}
            </div>
          ) : (
            data.map((p) => <PatientRow key={p.id} patient={p} />)
          )}
        </div>
      )}

      {tenantId && (
        <NewPatientModal
          open={showNewModal}
          onClose={() => setShowNewModal(false)}
          tenantId={tenantId}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
