"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, ChevronRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpeciesIcon } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";

function SetupBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
      <p className="text-amber-800 font-medium">Demo-Modus: Tenant-ID noch nicht konfiguriert</p>
      <p className="text-amber-600 text-sm mt-1">
        Nach <code className="bg-amber-100 px-1 rounded">npm run db:seed</code> bitte{" "}
        <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_DEMO_TENANT_ID</code> in{" "}
        <code className="bg-amber-100 px-1 rounded">.env.local</code> setzen.
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
      className="flex items-center gap-4 px-6 py-4 hover:bg-blue-50/50 transition-colors group border-b border-gray-100 last:border-0"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-xl flex-shrink-0">
        <SpeciesIcon species={patient.species} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{patient.name}</span>
          {!patient.active && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inaktiv</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {patient.species}
          {patient.breed ? ` · ${patient.breed}` : ""}
          {age !== null ? ` · ${age} J.` : ""}
        </p>
      </div>
      <div className="hidden md:block flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 truncate">
          {patient.ownerFirstName} {patient.ownerLastName}
        </p>
        {patient.ownerPhone && (
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Phone size={11} /> {patient.ownerPhone}
          </p>
        )}
      </div>
      <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Patienten</h1>
          <p className="text-gray-500 mt-1">
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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-[2.5rem_1fr_1fr_1.5rem] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div /><div>Patient</div><div>Halter</div><div />
          </div>

          {isLoading ? (
            <TableSkeleton rows={6} />
          ) : !data?.length ? (
            <div className="py-20 text-center text-gray-500">
              <div className="text-5xl mb-4">🐾</div>
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
