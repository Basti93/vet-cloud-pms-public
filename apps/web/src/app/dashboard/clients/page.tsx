"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Mail, PawPrint, Phone, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";

function formatDate(date: Date | string | null) {
  if (!date) return "Noch kein Termin";
  return new Date(date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function ClientsPage() {
  const { tenantId, isReady } = useTenant();
  const [search, setSearch] = useState("");
  const [showNewPet, setShowNewPet] = useState(false);

  const { data: owners, isLoading, refetch } = trpc.owners.list.useQuery(
    { tenantId: tenantId!, search: search || undefined },
    { enabled: !!tenantId }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-fg">Tierhalter</h1>
          <p className="text-muted mt-1">
            {owners ? `${owners.length} Kontakte mit ihren Tieren` : "Owner-zentrierte Kundenliste"}
          </p>
        </div>
        {tenantId && (
          <Button onClick={() => setShowNewPet(true)}>
            <Plus size={16} /> Tier hinzufügen
          </Button>
        )}
      </div>

      {isReady && !tenantId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          Tenant-ID noch nicht konfiguriert.
        </div>
      )}

      {tenantId && (
        <Input
          placeholder="Tierhalter nach Name, E-Mail oder Telefon suchen…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          icon={<Search size={16} />}
          className="max-w-md"
        />
      )}

      {tenantId && (
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.4fr_1.4fr_0.7fr_1fr_2rem] gap-4 px-6 py-3 bg-bg border-b border-border text-xs font-semibold text-muted uppercase tracking-wide">
            <div>Name</div>
            <div>Kontakt</div>
            <div>Tiere</div>
            <div>Letzter Termin</div>
            <div />
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted">Wird geladen…</div>
          ) : !owners?.length ? (
            <div className="py-20 text-center text-muted">
              <Users size={46} strokeWidth={1.5} className="mx-auto mb-4 text-[var(--color-accent)]" />
              <p className="font-medium">
                {search ? `Keine Ergebnisse für „${search}"` : "Noch keine Tierhalter angelegt"}
              </p>
              {!search && (
                <Button className="mt-4" onClick={() => setShowNewPet(true)}>
                  <Plus size={16} /> Ersten Tierhalter anlegen
                </Button>
              )}
            </div>
          ) : (
            owners.map((owner) => (
              <Link
                key={owner.id}
                href={`/dashboard/clients/${owner.id}`}
                className="grid grid-cols-1 gap-3 px-6 py-4 border-b border-border last:border-0 hover:bg-muted-soft transition-colors md:grid-cols-[1.4fr_1.4fr_0.7fr_1fr_2rem] md:items-center"
              >
                <div>
                  <div className="font-semibold text-fg">
                    {owner.firstName} {owner.lastName}
                  </div>

                </div>
                <div className="space-y-1 text-sm text-muted">
                  {owner.email && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail size={13} />
                      <span className="truncate">{owner.email}</span>
                    </div>
                  )}
                  {owner.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone size={13} />
                      {owner.phone}
                    </div>
                  )}
                  {!owner.email && !owner.phone && "Keine Kontaktdaten"}
                </div>
                <div className="flex items-center gap-2 text-sm text-fg">
                  <PawPrint size={15} className="text-[var(--color-accent)]" />
                  {owner.patientCount}
                </div>
                <div className="text-sm text-muted">{formatDate(owner.lastAppointment)}</div>
                <ChevronRight size={16} className="hidden md:block text-muted" />
              </Link>
            ))
          )}
        </div>
      )}

      {tenantId && (
        <NewPatientModal
          open={showNewPet}
          onClose={() => setShowNewPet(false)}
          tenantId={tenantId}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
