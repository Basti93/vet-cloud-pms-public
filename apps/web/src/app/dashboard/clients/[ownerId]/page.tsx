"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Calendar, ChevronLeft, Mail, PawPrint, Pencil, Phone, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SpeciesIcon } from "@/components/ui/badge";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClientDetailPage() {
  const params = useParams();
  const ownerId = params.ownerId as string;
  const { tenantId } = useTenant();
  const [editing, setEditing] = useState(false);
  const [showNewPet, setShowNewPet] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    notes: "",
  });

  const { data, isLoading, refetch } = trpc.owners.byId.useQuery(
    { id: ownerId, tenantId: tenantId || "" },
    { enabled: !!tenantId && !!ownerId }
  );

  useEffect(() => {
    if (!data?.owner) return;
    setForm({
      firstName: data.owner.firstName,
      lastName: data.owner.lastName,
      email: data.owner.email ?? "",
      phone: data.owner.phone ?? "",
      address: data.owner.address ?? "",
      city: data.owner.city ?? "",
      postalCode: data.owner.postalCode ?? "",
      notes: data.owner.notes ?? "",
    });
  }, [data?.owner]);

  const updateOwner = trpc.owners.update.useMutation({
    onSuccess: async () => {
      setEditing(false);
      await refetch();
    },
  });

  if (isLoading) {
    return <div className="py-12 text-center text-muted">Wird geladen…</div>;
  }

  if (!data) {
    return <div className="py-12 text-center text-red-600">Tierhalter nicht gefunden</div>;
  }

  const ownerName = `${data.owner.firstName} ${data.owner.lastName}`;

  const save = () => {
    if (!tenantId) return;
    updateOwner.mutate({
      id: ownerId,
      tenantId,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      postalCode: form.postalCode || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/clients" className="inline-flex items-center text-sm font-medium text-[var(--color-accent)] hover:underline">
        <ChevronLeft size={16} /> Zurück zu Tierhaltern
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-fg">{ownerName}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
            {data.owner.email && (
              <a href={`mailto:${data.owner.email}`} className="inline-flex items-center gap-1.5 hover:text-[var(--color-accent)]">
                <Mail size={14} /> {data.owner.email}
              </a>
            )}
            {data.owner.phone && (
              <a href={`tel:${data.owner.phone}`} className="inline-flex items-center gap-1.5 hover:text-[var(--color-accent)]">
                <Phone size={14} /> {data.owner.phone}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditing((value) => !value)}>
            <Pencil size={16} /> Bearbeiten
          </Button>
          <Button onClick={() => setShowNewPet(true)}>
            <Plus size={16} /> Tier hinzufügen
          </Button>
        </div>
      </div>

      {editing && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Vorname" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
            <Input label="Nachname" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
            <Input label="E-Mail" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            <Input label="Telefon" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            <Input label="Adresse" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
            <div className="grid grid-cols-[0.8fr_1fr] gap-3">
              <Input label="PLZ" value={form.postalCode} onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))} />
              <Input label="Ort" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} loading={updateOwner.isPending}>
              <Save size={16} /> Speichern
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">Tiere</h2>
            <span className="text-sm text-muted">{data.patients.length}</span>
          </div>
          <div className="divide-y divide-border">
            {data.patients.length ? data.patients.map((patient) => (
              <Link key={patient.id} href={`/dashboard/patients/${patient.id}`} className="flex items-center gap-3 py-3 hover:bg-muted-soft">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <SpeciesIcon species={patient.species} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-fg">{patient.name}</div>
                  <div className="text-sm text-muted">
                    {patient.species}{patient.breed ? ` · ${patient.breed}` : ""}
                  </div>
                </div>

              </Link>
            )) : (
              <div className="py-12 text-center text-muted">
                <PawPrint size={38} className="mx-auto mb-3 text-[var(--color-accent)]" />
                Noch keine Tiere hinterlegt
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">Terminhistorie</h2>
            <Calendar size={18} className="text-muted" />
          </div>
          <div className="divide-y divide-border">
            {data.recentAppointments.length ? data.recentAppointments.map((appointment) => (
              <div key={appointment.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-fg">{appointment.title}</div>
                    <div className="text-sm text-muted">
                      {appointment.patientName} · {appointment.patientSpecies}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted">
                    {formatDate(appointment.startTime)}
                  </div>
                </div>
              </div>
            )) : (
              <div className="py-12 text-center text-muted">Noch keine Termine</div>
            )}
          </div>
        </section>
      </div>

      {tenantId && (
        <NewPatientModal
          open={showNewPet}
          onClose={() => setShowNewPet(false)}
          tenantId={tenantId}
          ownerId={ownerId}
          ownerName={ownerName}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
