'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useParams } from 'next/navigation';
import { useTenant } from '@/hooks/useTenant';
import {
  ChevronLeft,
  Plus,
  Pill,
  Stethoscope,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Clock,
  Pencil,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/toast/context';
import { SearchableSelect } from '@/components/ui/searchable-select';

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.patientId as string;
  const { tenantId } = useTenant();
  const { addToast } = useToast();
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showVaccinationForm, setShowVaccinationForm] = useState(false);
  // null = create mode, string id = edit mode
  const [editingVaccinationId, setEditingVaccinationId] = useState<string | null>(null);
  // id of the vaccination pending delete confirmation
  const [deletingVaccinationId, setDeletingVaccinationId] = useState<string | null>(null);
  // Selected vaccination type id ("custom" for free-text)
  const [vaccinationTypeId, setVaccinationTypeId] = useState("");
  // Free-text name when vaccinationTypeId === "custom"
  const [vaccinationCustomType, setVaccinationCustomType] = useState("");
  const [vaccinationDate, setVaccinationDate] = useState("");
  const [vaccinationExpiry, setVaccinationExpiry] = useState("");
  const [vaccinationBatch, setVaccinationBatch] = useState("");
  const [vaccinationNotes, setVaccinationNotes] = useState("");

  // Fetch patient data
  const { data: patients, isLoading } = trpc.patients.list.useQuery(
    {
      tenantId: tenantId || '',
    },
    { enabled: !!tenantId }
  );
  const patient = patients?.find((p) => p.id === patientId);

  // Fetch medical data
  const { data: diagnosisList } = trpc.medical.diagnoses.list.useQuery(
    { patientId, tenantId: tenantId || '' },
    { enabled: !!patientId && !!tenantId }
  );
  const { data: medicationsList } = trpc.medical.medications.list.useQuery(
    { patientId, tenantId: tenantId || '' },
    { enabled: !!patientId && !!tenantId }
  );
  const { data: vitalsList } = trpc.medical.vitals.list.useQuery(
    { patientId, tenantId: tenantId || '' },
    { enabled: !!patientId && !!tenantId }
  );
  const { data: appointmentsList } = trpc.appointments.listByPatient.useQuery(
    { patientId, tenantId: tenantId || '' },
    { enabled: !!patientId && !!tenantId }
  );
  const { data: vaccinationsList, refetch: refetchVaccinations } = trpc.vaccinations.list.useQuery(
    { patientId, tenantId: tenantId || "" },
    { enabled: !!patientId && !!tenantId }
  );
  const { data: upcomingVaccinations } = trpc.vaccinations.getUpcoming.useQuery(
    { patientId, tenantId: tenantId || "", days: 90 },
    { enabled: !!patientId && !!tenantId }
  );

  // Vaccination type catalogue — tenant-aware, filtered in-memory by patient species
  const { data: allVacTypes } = trpc.vaccinations.getTypes.useQuery(
    { tenantId: tenantId ?? "", species: undefined },
    { enabled: !!tenantId }
  );

  const resetVaccinationForm = () => {
    setVaccinationTypeId("");
    setVaccinationCustomType("");
    setVaccinationDate("");
    setVaccinationExpiry("");
    setVaccinationBatch("");
    setVaccinationNotes("");
  };

  // Auto-fill expiry date when type + administered date are both set
  const handleVacTypeChange = (typeId: string) => {
    setVaccinationTypeId(typeId);
    if (typeId === "custom") return;
    const vt = allVacTypes?.find((t) => t.id === typeId);
    if (vt && vaccinationDate) {
      const administered = new Date(vaccinationDate);
      const expiry = new Date(administered);
      expiry.setMonth(expiry.getMonth() + vt.defaultIntervalMonths);
      setVaccinationExpiry(expiry.toISOString().split("T")[0]);
    }
  };

  const handleVacDateChange = (dateStr: string) => {
    setVaccinationDate(dateStr);
    if (!vaccinationTypeId || vaccinationTypeId === "custom") return;
    const vt = allVacTypes?.find((t) => t.id === vaccinationTypeId);
    if (vt && dateStr) {
      const administered = new Date(dateStr);
      const expiry = new Date(administered);
      expiry.setMonth(expiry.getMonth() + vt.defaultIntervalMonths);
      setVaccinationExpiry(expiry.toISOString().split("T")[0]);
    }
  };

  type VaccinationRow = NonNullable<typeof vaccinationsList>[number];

  const openEditDialog = (v: VaccinationRow) => {
    setEditingVaccinationId(v.id);
    // Restore type selection
    if (v.vaccinationTypeId) {
      setVaccinationTypeId(v.vaccinationTypeId);
      setVaccinationCustomType("");
    } else {
      setVaccinationTypeId("custom");
      setVaccinationCustomType(v.type);
    }
    setVaccinationDate(new Date(v.administeredDate).toISOString().split("T")[0]);
    setVaccinationExpiry(new Date(v.expiryDate).toISOString().split("T")[0]);
    setVaccinationBatch(v.batchNumber ?? "");
    setVaccinationNotes(v.notes ?? "");
    setShowVaccinationForm(true);
  };

  const createVaccination = trpc.vaccinations.create.useMutation({
    onSuccess: async () => {
      setShowVaccinationForm(false);
      resetVaccinationForm();
      addToast("Impfung erfasst.", "success");
      await refetchVaccinations();
    },
    onError: () => {
      addToast("Impfung konnte nicht gespeichert werden.", "error");
    },
  });

  const updateVaccination = trpc.vaccinations.update.useMutation({
    onSuccess: async () => {
      setShowVaccinationForm(false);
      setEditingVaccinationId(null);
      resetVaccinationForm();
      addToast("Impfung aktualisiert.", "success");
      await refetchVaccinations();
    },
    onError: () => {
      addToast("Impfung konnte nicht aktualisiert werden.", "error");
    },
  });

  const deleteVaccination = trpc.vaccinations.delete.useMutation({
    onSuccess: async () => {
      setDeletingVaccinationId(null);
      addToast("Impfung gelöscht.", "success");
      await refetchVaccinations();
    },
    onError: () => {
      addToast("Impfung konnte nicht gelöscht werden.", "error");
    },
  });

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!patient) {
    return <div className="text-center py-12 text-red-600">Patient not found</div>;
  }

  const allergies: string[] = [];
  // TODO: Allergies field will be available after DB migration
  const activeMeds = medicationsList?.filter((m) => !m.endDate) || [];
  const activeDiagnoses = diagnosisList?.filter((d) => d.status === 'active') || [];
  const latestVital = vitalsList?.[vitalsList.length - 1];

  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-DE', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <Link
          href="/dashboard/patients"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Zurück zu Patienten
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{patient.name}</h1>
            <p className="text-gray-600 mt-1">
              {patient.species}
              {patient.breed && ` • ${patient.breed}`}
            </p>
          </div>
          {/* Owner contact card */}
          <div className="text-right space-y-0.5">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Tierhalter</div>
            <Link
              href={`/dashboard/clients/${patient.ownerId}`}
              className="font-semibold text-gray-900 hover:text-blue-600 hover:underline"
            >
              {[patient.ownerFirstName, patient.ownerLastName].filter(Boolean).join(" ") || "—"}
            </Link>
            {patient.ownerPhone && (
              <a
                href={`tel:${patient.ownerPhone}`}
                className="flex items-center justify-end gap-1.5 text-sm text-blue-600 hover:underline"
              >
                {patient.ownerPhone}
              </a>
            )}
            {patient.ownerEmail && (
              <a
                href={`mailto:${patient.ownerEmail}`}
                className="flex items-center justify-end gap-1.5 text-sm text-blue-600 hover:underline"
              >
                {patient.ownerEmail}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 font-medium">Gewicht</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {patient.weight ? (patient.weight / 1000).toFixed(1) : '-'} kg
            </p>
            {latestVital?.weight && (
              <p className="text-xs text-gray-500 mt-1">
                Letzte Messung: {formatDate(latestVital.recordedAt)}
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 font-medium">Farbe</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{patient.color || '-'}</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 font-medium">Aktive Diagnosen</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{activeDiagnoses.length}</p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600 font-medium">Medikamente</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{activeMeds.length}</p>
          </div>
        </div>

        {/* Allergies Alert */}
        {allergies.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Allergien</h3>
                <p className="text-red-800 mt-1">{allergies.join(', ')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Medical Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Diagnoses */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-blue-600" />
                Diagnosen
              </h2>
              <button
                onClick={() => setShowDiagnosisForm(true)}
                className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Hinzufügen
              </button>
            </div>

            {activeDiagnoses && activeDiagnoses.length > 0 ? (
              <div className="space-y-3">
                {activeDiagnoses.map((dx) => (
                  <div key={dx.id} className="border border-gray-200 rounded p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{dx.title}</p>
                        {dx.description && (
                          <p className="text-sm text-gray-600 mt-1">{dx.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {formatDate(dx.dateOfDiagnosis)}
                          {dx.severity && ` • ${dx.severity}`}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          dx.status === 'active'
                            ? 'bg-yellow-100 text-yellow-800'
                            : dx.status === 'resolved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {dx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Keine aktiven Diagnosen</p>
            )}
          </div>

          {/* Medications */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Pill className="w-5 h-5 text-green-600" />
                Medikamente
              </h2>
              <button
                onClick={() => setShowMedicationForm(true)}
                className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Hinzufügen
              </button>
            </div>

            {activeMeds && activeMeds.length > 0 ? (
              <div className="space-y-3">
                {activeMeds.map((med) => (
                  <div key={med.id} className="border border-gray-200 rounded p-3">
                    <p className="font-semibold text-gray-900">{med.medicationName}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {med.dosage} • {med.frequency}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Seit {formatDate(med.startDate)} • Route: {med.route}
                    </p>
                    {med.notes && (
                      <p className="text-xs text-gray-600 mt-2 italic">{med.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Keine aktiven Medikamente</p>
            )}
          </div>
        </div>

        {/* Appointments/Termine */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Termine & Ärzte
            </h2>
          </div>

          {appointmentsList && appointmentsList.length > 0 ? (
            <div className="space-y-3">
              {appointmentsList.map((apt) => (
                <div key={apt.id} className="border border-gray-200 rounded p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{apt.title}</p>
                      <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {new Date(apt.startTime).toLocaleDateString('de-DE', {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {apt.vetFirstName && apt.vetLastName && (
                        <p className="text-sm text-indigo-600 mt-1 font-medium">
                          Dr. {apt.vetFirstName} {apt.vetLastName}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                        apt.status === 'scheduled'
                          ? 'bg-yellow-100 text-yellow-800'
                          : apt.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : apt.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {apt.status === 'scheduled' && 'Geplant'}
                      {apt.status === 'completed' && 'Abgeschlossen'}
                      {apt.status === 'cancelled' && 'Abgesagt'}
                      {apt.status === 'no-show' && 'Nicht erschienen'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Keine Termine erfasst</p>
          )}
        </div>

        {/* Vitals */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-purple-600" />
              Vitalzeichen & Gewicht
            </h2>
            <button
              onClick={() => setShowVitalsForm(true)}
              className="flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Messung hinzufügen
            </button>
          </div>

          {vitalsList && vitalsList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2 px-3 font-semibold text-gray-900">Datum</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-900">Gewicht</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-900">Temperatur</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-900">Puls</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-900">Atemf.</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-900">Notizen</th>
                  </tr>
                </thead>
                <tbody>
                  {vitalsList.map((vital) => (
                    <tr key={vital.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3">{formatDate(vital.recordedAt)}</td>
                      <td className="py-3 px-3">
                        {vital.weight ? (vital.weight / 1000).toFixed(1) : '-'} kg
                      </td>
                      <td className="py-3 px-3">{vital.temperature || '-'}</td>
                      <td className="py-3 px-3">{vital.heartRate || '-'} bpm</td>
                      <td className="py-3 px-3">{vital.respiratoryRate || '-'} /min</td>
                      <td className="py-3 px-3 text-gray-600 text-xs">{vital.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Keine Vitalzeichen erfasst</p>
          )}
        </div>

        <div id="impfhistorie" className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Impfhistorie</h2>
            <button
              onClick={() => setShowVaccinationForm(true)}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Impfung hinzufügen
            </button>
          </div>
          <p className="mb-4 text-sm text-gray-600">
            Anstehende Booster (90 Tage): {upcomingVaccinations?.length ?? 0}
          </p>
          {vaccinationsList && vaccinationsList.length > 0 ? (
            <div className="space-y-2">
              {vaccinationsList.map((v) => {
                const now = new Date();
                const expiry = new Date(v.expiryDate);
                const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
                const isOverdue = expiry < now;
                const isDueSoon = !isOverdue && daysLeft <= 30;
                return (
                  <div key={v.id} className="flex items-start justify-between rounded-xl border border-border bg-surface p-3 shadow-sm group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-fg text-sm">{v.type}</span>
                        {v.typeCategory && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            v.typeCategory === "core"
                              ? "bg-blue-100 text-blue-700"
                              : v.typeCategory === "recommended"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-muted-soft text-muted"
                          }`}>
                            {v.typeCategory === "core" ? "Core" : v.typeCategory === "recommended" ? "Empfohlen" : "Optional"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-1">
                        Verabreicht: {formatDate(v.administeredDate)}
                        {v.vetFirstName && ` · ${v.vetFirstName} ${v.vetLastName ?? ""}`}
                        {v.batchNumber && ` · Charge: ${v.batchNumber}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`text-xs font-medium ${isOverdue ? "text-red-600" : isDueSoon ? "text-amber-600" : "text-green-600"}`}>
                        {isOverdue
                          ? `Überfällig seit ${Math.abs(daysLeft)} T.`
                          : isDueSoon
                          ? `Fällig in ${daysLeft} T.`
                          : formatDate(v.expiryDate)}
                      </span>
                      <button
                        onClick={() => openEditDialog(v)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted-soft text-muted hover:text-fg"
                        title="Bearbeiten"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingVaccinationId(v.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-muted hover:text-red-600"
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted text-center py-4 text-sm">Keine Impfungen erfasst</p>
          )}
        </div>
      </div>

      {/* Vaccination Dialog */}
      <Dialog open={showVaccinationForm} onOpenChange={(open) => { setShowVaccinationForm(open); if (!open) { resetVaccinationForm(); setEditingVaccinationId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVaccinationId ? "Impfung bearbeiten" : "Impfung erfassen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Vaccination type selector — species-filtered */}
            {(() => {
              const speciesTypes = (allVacTypes ?? []).filter((t) =>
                patient?.species ? t.species.toLowerCase().includes(patient.species.toLowerCase()) : true
              );
              const typeOptions = [
                ...speciesTypes.map((t) => ({
                  value: t.id,
                  label: t.name,
                  searchText: `${t.code} ${t.category}`,
                })),
                { value: "custom", label: "Sonstiges (frei eingeben)" },
              ];
              const selectedVt = allVacTypes?.find((t) => t.id === vaccinationTypeId);
              return (
                <>
                  <SearchableSelect
                    label="Impfstoff *"
                    placeholder="Impftyp suchen (z.B. Leptospirose, RCP…)"
                    value={vaccinationTypeId}
                    onChange={handleVacTypeChange}
                    options={typeOptions}
                  />
                  {/* Custom free-text input */}
                  {vaccinationTypeId === "custom" && (
                    <label className="block text-sm text-fg">
                      Bezeichnung *
                      <input
                        className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        placeholder="z.B. Combo XY, Spezialimpfung"
                        value={vaccinationCustomType}
                        onChange={(e) => setVaccinationCustomType(e.target.value)}
                      />
                    </label>
                  )}
                  {/* Info bar for selected type */}
                  {selectedVt && (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700 space-y-0.5">
                      <div className="font-semibold">{selectedVt.name} ({selectedVt.code})</div>
                      <div>Standardintervall: {selectedVt.defaultIntervalMonths} Monate · Kategorie: {selectedVt.category === "core" ? "Core-Impfung" : selectedVt.category === "recommended" ? "Empfohlen" : "Optional"}</div>
                      {selectedVt.notes && <div className="text-blue-600">{selectedVt.notes}</div>}
                      {selectedVt.requiresBatchNumber && (
                        <div className="font-semibold text-amber-700">⚠ Chargennummer erforderlich (z.B. für EU-Heimtierausweis)</div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            <label className="block text-sm text-fg">
              Verabreicht am *
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={vaccinationDate}
                onChange={(e) => handleVacDateChange(e.target.value)}
              />
            </label>
            <label className="block text-sm text-fg">
              Fällig am (Auffrischung) *
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={vaccinationExpiry}
                onChange={(e) => setVaccinationExpiry(e.target.value)}
              />
            </label>
            <label className="block text-sm text-fg">
              Chargennummer
              <input
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="z.B. B2024-001"
                value={vaccinationBatch}
                onChange={(e) => setVaccinationBatch(e.target.value)}
              />
            </label>
            <label className="block text-sm text-fg">
              Notizen
              <textarea
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="Optionale Anmerkungen"
                value={vaccinationNotes}
                onChange={(e) => setVaccinationNotes(e.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowVaccinationForm(false); setEditingVaccinationId(null); resetVaccinationForm(); }}>
              Abbrechen
            </Button>
            <Button
              loading={createVaccination.isPending || updateVaccination.isPending}
              disabled={
                !vaccinationTypeId ||
                (vaccinationTypeId === "custom" && !vaccinationCustomType) ||
                !vaccinationDate ||
                !vaccinationExpiry
              }
              onClick={() => {
                const selectedType = allVacTypes?.find((t) => t.id === vaccinationTypeId);
                const resolvedName =
                  vaccinationTypeId === "custom"
                    ? vaccinationCustomType
                    : (selectedType?.name ?? "");
                if (!tenantId || !resolvedName || !vaccinationDate || !vaccinationExpiry) return;

                // Route FK to the right column based on type source
                const globalTypeId =
                  selectedType?.source === "global" ? selectedType.id : null;
                const customConfigId =
                  selectedType?.source === "custom" ? selectedType.id : null;

                if (editingVaccinationId) {
                  updateVaccination.mutate({
                    tenantId,
                    vaccinationId: editingVaccinationId,
                    vaccinationTypeId: globalTypeId,
                    tenantVaccinationTypeConfigId: customConfigId,
                    type: resolvedName,
                    administeredDate: new Date(vaccinationDate),
                    expiryDate: new Date(vaccinationExpiry),
                    batchNumber: vaccinationBatch || null,
                    notes: vaccinationNotes || null,
                  });
                } else {
                  createVaccination.mutate({
                    tenantId,
                    patientId,
                    vaccinationTypeId: globalTypeId ?? undefined,
                    tenantVaccinationTypeConfigId: customConfigId ?? undefined,
                    type: resolvedName,
                    administeredDate: new Date(vaccinationDate),
                    expiryDate: new Date(vaccinationExpiry),
                    batchNumber: vaccinationBatch || undefined,
                    notes: vaccinationNotes || undefined,
                  });
                }
              }}
            >
              {editingVaccinationId ? "Aktualisieren" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete vaccination confirmation dialog */}
      <Dialog open={!!deletingVaccinationId} onOpenChange={(open) => { if (!open) setDeletingVaccinationId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impfung löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted">Diese Aktion kann nicht rückgängig gemacht werden. Der Impfeintrag wird dauerhaft gelöscht.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingVaccinationId(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              loading={deleteVaccination.isPending}
              onClick={() => {
                if (!tenantId || !deletingVaccinationId) return;
                deleteVaccination.mutate({ tenantId, vaccinationId: deletingVaccinationId });
              }}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Placeholder for other forms (diagnosis, medication, vitals) */}
      {(showDiagnosisForm || showMedicationForm || showVitalsForm) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <p className="text-muted">Formular folgt im nächsten Sprint.</p>
            <button
              className="mt-4 rounded border border-border px-3 py-2 text-sm text-fg"
              onClick={() => {
                setShowDiagnosisForm(false);
                setShowMedicationForm(false);
                setShowVitalsForm(false);
              }}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
