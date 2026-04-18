"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { AppointmentStatusBadge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Trash2 } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  onSuccess?: () => void;
  /** Pre-select a patient (e.g. when opening from the patient detail page) */
  preselectedPatientId?: string;
  /** Pre-fill when editing an existing appointment */
  editData?: {
    id: string;
    title: string;
    description: string | null;
    startTime: Date;
    endTime: Date;
    status: string;
    patientId: string;
    vetId: string;
    patientName?: string | null;
  };
  /** Pre-fill start time when clicking empty slot in calendar */
  defaultStart?: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AppointmentModal({
  open,
  onClose,
  tenantId,
  onSuccess,
  editData,
  defaultStart,
  preselectedPatientId,
}: AppointmentModalProps) {
  const isEdit = !!editData;
  const defaultStartDate = defaultStart ?? new Date();
  const defaultEndDate = addMinutes(defaultStartDate, 30);

  const [form, setForm] = useState({
    title: editData?.title ?? "",
    description: editData?.description ?? "",
    patientId: editData?.patientId ?? preselectedPatientId ?? "",
    vetId: editData?.vetId ?? "",
    startTime: toLocalDateTimeInput(editData?.startTime ? new Date(editData.startTime) : defaultStartDate),
    endTime: toLocalDateTimeInput(editData?.endTime ? new Date(editData.endTime) : defaultEndDate),
    status: (editData?.status ?? "scheduled") as string,
    durationMin: "30",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset on open/edit change
  useEffect(() => {
    if (open) {
      const s = defaultStart ?? new Date();
      setForm({
        title: editData?.title ?? "",
        description: editData?.description ?? "",
        patientId: editData?.patientId ?? preselectedPatientId ?? "",
        vetId: editData?.vetId ?? "",
        startTime: toLocalDateTimeInput(editData?.startTime ? new Date(editData.startTime) : s),
        endTime: toLocalDateTimeInput(editData?.endTime ? new Date(editData.endTime) : addMinutes(s, 30)),
        status: editData?.status ?? "scheduled",
        durationMin: "30",
      });
      setErrors({});
      setConfirmDelete(false);
    }
  }, [open, editData, defaultStart]);

  // Auto-adjust end time when start or duration changes
  const handleStartChange = (val: string) => {
    const start = new Date(val);
    const end = addMinutes(start, parseInt(form.durationMin) || 30);
    setForm((f) => ({ ...f, startTime: val, endTime: toLocalDateTimeInput(end) }));
  };

  const handleDurationChange = (val: string) => {
    const start = new Date(form.startTime);
    const end = addMinutes(start, parseInt(val) || 30);
    setForm((f) => ({ ...f, durationMin: val, endTime: toLocalDateTimeInput(end) }));
  };

  // Queries
  const { data: patients } = trpc.patients.list.useQuery(
    { tenantId },
    { enabled: open }
  );

  const { data: vets } = trpc.vet.list.useQuery(
    { tenantId },
    { enabled: open }
  );

  // Mutations
  const createAppt = trpc.appointments.create.useMutation({ onSuccess: () => { onSuccess?.(); onClose(); } });
  const updateAppt = trpc.appointments.update.useMutation({ onSuccess: () => { onSuccess?.(); onClose(); } });
  const deleteAppt = trpc.appointments.delete.useMutation({ onSuccess: () => { onSuccess?.(); onClose(); } });

  const set = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Bitte Titel angeben";
    if (!form.patientId) errs.patientId = "Bitte Patient auswählen";
    if (!form.vetId) errs.vetId = "Bitte Arzt auswählen";
    if (!form.startTime) errs.startTime = "Pflichtfeld";
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const startTime = new Date(form.startTime);
    const endTime = new Date(form.endTime);

    if (isEdit && editData) {
      updateAppt.mutate({
        id: editData.id,
        tenantId,
        title: form.title,
        description: form.description || undefined,
        startTime,
        endTime,
        status: form.status as any,
        vetId: form.vetId,
      });
    } else {
      createAppt.mutate({
        tenantId,
        patientId: form.patientId,
        vetId: form.vetId,
        startTime,
        endTime,
        title: form.title,
        description: form.description || undefined,
        source: "manual",
      });
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    if (editData) deleteAppt.mutate({ id: editData.id, tenantId });
  };

  const isLoading = createAppt.isPending || updateAppt.isPending;
  const error = createAppt.error ?? updateAppt.error;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Termin bearbeiten" : "Neuer Termin"}
      description={isEdit && editData?.patientName ? `Patient: ${editData.patientName}` : undefined}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Patient */}
        <Select
          label="Patient *"
          value={form.patientId}
          onChange={(e) => set("patientId", e.target.value)}
          error={errors.patientId}
          disabled={isEdit || !!preselectedPatientId}
        >
          <option value="">— Patient auswählen —</option>
          {patients?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.species}{p.breed ? ` · ${p.breed}` : ""}) — {p.ownerFirstName} {p.ownerLastName}
            </option>
          ))}
        </Select>

        {/* Vet */}
        <Select
          label="Arzt *"
          value={form.vetId}
          onChange={(e) => set("vetId", e.target.value)}
          error={errors.vetId}
        >
          <option value="">— Arzt auswählen —</option>
          {vets?.map((v) => (
            <option key={v.id} value={v.id}>
              Dr. {v.firstName} {v.lastName} ({v.appointmentCount} Termine)
            </option>
          ))}
        </Select>

        {/* Title */}
        <Input
          label="Titel / Grund *"
          placeholder="z.B. Jährliche Impfung, Vorsorgeuntersuchung…"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          error={errors.title}
        />

        {/* Date/Time */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Beginn *"
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => handleStartChange(e.target.value)}
            error={errors.startTime}
          />
          <Select
            label="Dauer"
            value={form.durationMin}
            onChange={(e) => handleDurationChange(e.target.value)}
          >
            {[15, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={String(m)}>
                {m < 60 ? `${m} Min.` : `${m / 60} Std.`}
              </option>
            ))}
          </Select>
        </div>

        {/* End time (readonly, auto-calculated) */}
        <Input
          label="Ende (berechnet)"
          type="datetime-local"
          value={form.endTime}
          onChange={(e) => set("endTime", e.target.value)}
        />

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notizen / Anmerkungen</label>
          <textarea
            rows={3}
            placeholder="Symptome, Besonderheiten, Vorbereitung…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
          />
        </div>

        {/* Status (edit only) */}
        {isEdit && (
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="scheduled">Geplant</option>
            <option value="completed">Abgeschlossen</option>
            <option value="confirmed">Bestätigt</option>
            <option value="cancelled">Abgesagt</option>
            <option value="no-show">Nicht erschienen</option>
          </Select>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              loading={deleteAppt.isPending}
              className="flex-shrink-0"
            >
              <Trash2 size={14} />
              {confirmDelete ? "Wirklich löschen?" : "Löschen"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Abbrechen
          </Button>
          <Button type="submit" loading={isLoading} className="flex-1">
            {isEdit ? "Speichern" : "Termin anlegen"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
