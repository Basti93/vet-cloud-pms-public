"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

interface NewPatientModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  ownerId?: string;
  ownerName?: string;
  onSuccess?: () => void;
}

const SPECIES_OPTIONS = [
  "Hund", "Katze", "Kaninchen", "Frettchen", "Pferd",
  "Vogel", "Hamster", "Meerschweinchen", "Reptil", "Fisch", "Sonstiges",
];

export function NewPatientModal({
  open,
  onClose,
  tenantId,
  ownerId,
  ownerName,
  onSuccess,
}: NewPatientModalProps) {
  const [ownerMode, setOwnerMode] = useState<"select" | "create">("select");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState(ownerId ?? "");
  const [ownerForm, setOwnerForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [patientForm, setPatientForm] = useState({
    name: "",
    species: "Hund",
    breed: "",
    birthDate: "",
    weight: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: owners } = trpc.owners.list.useQuery(
    { tenantId, search: ownerSearch || undefined, limit: 12 },
    { enabled: open && !ownerId }
  );

  const createOwner = trpc.owners.create.useMutation();
  const createPatient = trpc.patients.create.useMutation({
    onSuccess: () => {
      onSuccess?.();
      handleClose();
    },
  });

  const selectedOwnerLabel = useMemo(() => {
    if (ownerId && ownerName) return ownerName;
    const selected = owners?.find((owner) => owner.id === selectedOwnerId);
    return selected ? `${selected.firstName} ${selected.lastName}` : "";
  }, [ownerId, ownerName, owners, selectedOwnerId]);

  const handleClose = () => {
    onClose();
    setOwnerMode("select");
    setOwnerSearch("");
    setSelectedOwnerId(ownerId ?? "");
    setOwnerForm({ firstName: "", lastName: "", email: "", phone: "" });
    setPatientForm({ name: "", species: "Hund", breed: "", birthDate: "", weight: "", notes: "" });
    setErrors({});
  };

  const setOwner = (field: keyof typeof ownerForm, value: string) => {
    setOwnerForm((form) => ({ ...form, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "", form: "" }));
  };

  const setPatient = (field: keyof typeof patientForm, value: string) => {
    setPatientForm((form) => ({ ...form, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "", form: "" }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!selectedOwnerId && ownerMode === "select") nextErrors.ownerId = "Bitte Tierhalter auswählen";
    if (ownerMode === "create") {
      if (!ownerForm.firstName.trim()) nextErrors.firstName = "Pflichtfeld";
      if (!ownerForm.lastName.trim()) nextErrors.lastName = "Pflichtfeld";
    }
    if (!patientForm.name.trim()) nextErrors.name = "Pflichtfeld";
    if (!patientForm.species) nextErrors.species = "Pflichtfeld";
    return nextErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      let targetOwnerId = selectedOwnerId;
      if (ownerMode === "create") {
        const owner = await createOwner.mutateAsync({
          tenantId,
          firstName: ownerForm.firstName,
          lastName: ownerForm.lastName,
          email: ownerForm.email || undefined,
          phone: ownerForm.phone || undefined,
        });
        targetOwnerId = owner.id;
      }

      await createPatient.mutateAsync({
        tenantId,
        ownerId: targetOwnerId,
        name: patientForm.name,
        species: patientForm.species,
        breed: patientForm.breed || undefined,
        birthDate: patientForm.birthDate ? new Date(patientForm.birthDate) : undefined,
        weight: patientForm.weight ? Math.round(parseFloat(patientForm.weight) * 1000) : undefined,
        notes: patientForm.notes || undefined,
      });
    } catch {
      setErrors((current) => ({
        ...current,
        form: "Tier konnte nicht angelegt werden. Bitte prüfen Sie die Angaben.",
      }));
    }
  };

  const isSaving = createOwner.isPending || createPatient.isPending;

  return (
    <Modal open={open} onClose={handleClose} title="Tier hinzufügen" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Tierhalter</h3>
            {!ownerId && (
              <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setOwnerMode("select")}
                  className={`px-3 py-1.5 text-sm rounded-lg ${ownerMode === "select" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
                >
                  Auswählen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOwnerMode("create");
                    setSelectedOwnerId("");
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg ${ownerMode === "create" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
                >
                  Neu
                </button>
              </div>
            )}
          </div>

          {ownerId ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900">
              {selectedOwnerLabel}
            </div>
          ) : ownerMode === "select" ? (
            <div className="space-y-3">
              <Input
                placeholder="Name, E-Mail oder Telefon suchen"
                value={ownerSearch}
                onChange={(event) => setOwnerSearch(event.target.value)}
                icon={<Search size={16} />}
                error={errors.ownerId}
              />
              <div className="max-h-44 overflow-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                {owners?.length ? owners.map((owner) => (
                  <button
                    key={owner.id}
                    type="button"
                    onClick={() => {
                      setSelectedOwnerId(owner.id);
                      setErrors((current) => ({ ...current, ownerId: "" }));
                    }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 ${selectedOwnerId === owner.id ? "bg-blue-50" : "bg-white"}`}
                  >
                    <span className="font-medium text-gray-900">{owner.firstName} {owner.lastName}</span>
                    <span className="block text-xs text-gray-500">
                      {[owner.email, owner.phone].filter(Boolean).join(" · ") || "Keine Kontaktdaten"}
                    </span>
                  </button>
                )) : (
                  <div className="px-4 py-5 text-center text-sm text-gray-500">Keine Tierhalter gefunden</div>
                )}
              </div>
              <Button type="button" variant="outline" onClick={() => setOwnerMode("create")}>
                <UserPlus size={16} /> Neuen Tierhalter anlegen
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Vorname *" value={ownerForm.firstName} onChange={(event) => setOwner("firstName", event.target.value)} error={errors.firstName} />
              <Input label="Nachname *" value={ownerForm.lastName} onChange={(event) => setOwner("lastName", event.target.value)} error={errors.lastName} />
              <Input label="Telefon" type="tel" value={ownerForm.phone} onChange={(event) => setOwner("phone", event.target.value)} />
              <Input label="E-Mail" type="email" value={ownerForm.email} onChange={(event) => setOwner("email", event.target.value)} />
            </div>
          )}
        </div>

        <div className="border-t border-gray-100" />

        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Tier</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name des Tieres *" value={patientForm.name} onChange={(event) => setPatient("name", event.target.value)} error={errors.name} />
            <Select label="Tierart *" value={patientForm.species} onChange={(event) => setPatient("species", event.target.value)} error={errors.species}>
              {SPECIES_OPTIONS.map((species) => <option key={species} value={species}>{species}</option>)}
            </Select>
            <Input label="Rasse" value={patientForm.breed} onChange={(event) => setPatient("breed", event.target.value)} />
            <Input label="Geburtsdatum" type="date" value={patientForm.birthDate} onChange={(event) => setPatient("birthDate", event.target.value)} />
            <Input label="Gewicht (kg)" type="number" step="0.1" min="0" value={patientForm.weight} onChange={(event) => setPatient("weight", event.target.value)} />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notizen</label>
            <textarea
              rows={3}
              value={patientForm.notes}
              onChange={(event) => setPatient("notes", event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
            />
          </div>
        </div>

        {(errors.form || createPatient.error || createOwner.error) && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {errors.form || createPatient.error?.message || createOwner.error?.message}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} className="flex-1">Abbrechen</Button>
          <Button type="submit" className="flex-1" loading={isSaving}>Tier anlegen</Button>
        </div>
      </form>
    </Modal>
  );
}
