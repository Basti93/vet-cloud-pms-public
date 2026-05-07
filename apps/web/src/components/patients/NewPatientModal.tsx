"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

interface NewPatientModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
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
  onSuccess,
}: NewPatientModalProps) {
  const [form, setForm] = useState({
    // Owner
    ownerFirstName: "",
    ownerLastName: "",
    ownerEmail: "",
    ownerPhone: "",
    // Patient
    name: "",
    species: "Hund",
    breed: "",
    birthDate: "",
    weight: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createPatient = trpc.patients.create.useMutation({
    onSuccess: () => {
      onSuccess?.();
      onClose();
      setForm({
        ownerFirstName: "", ownerLastName: "", ownerEmail: "", ownerPhone: "",
        name: "", species: "Hund", breed: "", birthDate: "", weight: "", notes: "",
      });
    },
  });

  const set = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.ownerFirstName.trim()) errs.ownerFirstName = "Pflichtfeld";
    if (!form.ownerLastName.trim()) errs.ownerLastName = "Pflichtfeld";
    if (!form.name.trim()) errs.name = "Pflichtfeld";
    if (!form.species) errs.species = "Pflichtfeld";
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    createPatient.mutate({
      tenantId,
      ownerFirstName: form.ownerFirstName,
      ownerLastName: form.ownerLastName,
      ownerEmail: form.ownerEmail || undefined,
      ownerPhone: form.ownerPhone || undefined,
      name: form.name,
      species: form.species,
      breed: form.breed || undefined,
      birthDate: form.birthDate ? new Date(form.birthDate) : undefined,
      weight: form.weight ? Math.round(parseFloat(form.weight) * 1000) : undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Neuer Patient" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Owner Section */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Halter / Besitzer
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Vorname *"
              placeholder="Max"
              value={form.ownerFirstName}
              onChange={(e) => set("ownerFirstName", e.target.value)}
              error={errors.ownerFirstName}
            />
            <Input
              label="Nachname *"
              placeholder="Mustermann"
              value={form.ownerLastName}
              onChange={(e) => set("ownerLastName", e.target.value)}
              error={errors.ownerLastName}
            />
            <Input
              label="Telefon"
              placeholder="0176 123 456"
              type="tel"
              value={form.ownerPhone}
              onChange={(e) => set("ownerPhone", e.target.value)}
            />
            <Input
              label="E-Mail"
              placeholder="max@example.de"
              type="email"
              value={form.ownerEmail}
              onChange={(e) => set("ownerEmail", e.target.value)}
            />
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Patient Section */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Patient / Tier
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Name des Tieres *"
              placeholder="Bello"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              error={errors.name}
            />
            <Select
              label="Tierart *"
              value={form.species}
              onChange={(e) => set("species", e.target.value)}
              error={errors.species}
            >
              {SPECIES_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Input
              label="Rasse"
              placeholder="z.B. Labrador Retriever"
              value={form.breed}
              onChange={(e) => set("breed", e.target.value)}
            />
            <Input
              label="Geburtsdatum"
              type="date"
              value={form.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
            />
            <Input
              label="Gewicht (kg)"
              type="number"
              step="0.1"
              min="0"
              placeholder="z.B. 12.5"
              value={form.weight}
              onChange={(e) => set("weight", e.target.value)}
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notizen</label>
            <textarea
              rows={3}
              placeholder="Besonderheiten, Allergien, Vorerkrankungen…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
            />
          </div>
        </div>

        {/* Error */}
        {createPatient.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {createPatient.error.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Abbrechen
          </Button>
          <Button
            type="submit"
            className="flex-1"
            loading={createPatient.isPending}
          >
            Patient anlegen
          </Button>
        </div>
      </form>
    </Modal>
  );
}
