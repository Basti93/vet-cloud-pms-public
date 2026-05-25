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
import { AppointmentModal } from '@/components/appointments/AppointmentModal';

const SEVERITY_LABELS: Record<string, string> = {
  mild: 'Leicht',
  moderate: 'Mittel',
  severe: 'Schwer',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  resolved: 'Geheilt',
  monitoring: 'Beobachtung',
};

const ROUTE_LABELS: Record<string, string> = {
  oral: 'Oral',
  injection: 'Injektion',
  topical: 'Topisch',
  ophthalmic: 'Augen',
  other: 'Sonstiges',
};

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.patientId as string;
  const { tenantId } = useTenant();
  const { addToast } = useToast();

  // Dialog open state
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showVaccinationForm, setShowVaccinationForm] = useState(false);
  const [showAllergiesForm, setShowAllergiesForm] = useState(false);

  // Appointment modal
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [selectedAptId, setSelectedAptId] = useState<string | null>(null);

  // Vaccination form state
  const [editingVaccinationId, setEditingVaccinationId] = useState<string | null>(null);
  const [deletingVaccinationId, setDeletingVaccinationId] = useState<string | null>(null);
  const [vaccinationTypeId, setVaccinationTypeId] = useState('');
  const [vaccinationCustomType, setVaccinationCustomType] = useState('');
  const [vaccinationDate, setVaccinationDate] = useState('');
  const [vaccinationExpiry, setVaccinationExpiry] = useState('');
  const [vaccinationBatch, setVaccinationBatch] = useState('');
  const [vaccinationNotes, setVaccinationNotes] = useState('');

  // Diagnosis form state
  const [dxTitle, setDxTitle] = useState('');
  const [dxDescription, setDxDescription] = useState('');
  const [dxIcd10, setDxIcd10] = useState('');
  const [dxSeverity, setDxSeverity] = useState<'mild' | 'moderate' | 'severe' | ''>('');
  const [dxStatus, setDxStatus] = useState<'active' | 'resolved' | 'monitoring'>('active');
  const [dxDate, setDxDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Medication form state
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFrequency, setMedFrequency] = useState('');
  const [medRoute, setMedRoute] = useState<'oral' | 'injection' | 'topical' | 'ophthalmic' | 'other'>('oral');
  const [medStartDate, setMedStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [medEndDate, setMedEndDate] = useState('');
  const [medNotes, setMedNotes] = useState('');
  const [medDiagnosisId, setMedDiagnosisId] = useState('');

  // Vitals form state
  const [vitWeight, setVitWeight] = useState('');
  const [vitTemp, setVitTemp] = useState('');
  const [vitHr, setVitHr] = useState('');
  const [vitRr, setVitRr] = useState('');
  const [vitNotes, setVitNotes] = useState('');
  const [vitDate, setVitDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Allergies form state
  const [allergiesText, setAllergiesText] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: patients, isLoading } = trpc.patients.list.useQuery(
    { tenantId: tenantId || '' },
    { enabled: !!tenantId }
  );
  const patient = patients?.find((p) => p.id === patientId);

  const { data: diagnosisList, refetch: refetchDiagnoses } = trpc.medical.diagnoses.list.useQuery(
    { patientId, tenantId: tenantId || '' },
    { enabled: !!patientId && !!tenantId }
  );
  const { data: medicationsList, refetch: refetchMedications } = trpc.medical.medications.list.useQuery(
    { patientId, tenantId: tenantId || '' },
    { enabled: !!patientId && !!tenantId }
  );
  const { data: vitalsList, refetch: refetchVitals } = trpc.medical.vitals.list.useQuery(
    { patientId, tenantId: tenantId || '' },
    { enabled: !!patientId && !!tenantId }
  );
  const { data: appointmentsList } = trpc.appointments.listByPatient.useQuery(
    { patientId, tenantId: tenantId || '' },
    { enabled: !!patientId && !!tenantId }
  );
  const { data: vaccinationsList, refetch: refetchVaccinations } = trpc.vaccinations.list.useQuery(
    { patientId, tenantId: tenantId || '' },
    { enabled: !!patientId && !!tenantId }
  );
  const { data: upcomingVaccinations } = trpc.vaccinations.getUpcoming.useQuery(
    { patientId, tenantId: tenantId || '', days: 90 },
    { enabled: !!patientId && !!tenantId }
  );
  const { data: allVacTypes } = trpc.vaccinations.getTypes.useQuery(
    { tenantId: tenantId ?? '', species: undefined },
    { enabled: !!tenantId }
  );

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createDiagnosis = trpc.medical.diagnoses.create.useMutation({
    onSuccess: async () => {
      setShowDiagnosisForm(false);
      resetDxForm();
      addToast('Diagnose gespeichert.', 'success');
      await refetchDiagnoses();
    },
    onError: () => addToast('Diagnose konnte nicht gespeichert werden.', 'error'),
  });

  const createMedication = trpc.medical.medications.create.useMutation({
    onSuccess: async () => {
      setShowMedicationForm(false);
      resetMedForm();
      addToast('Medikament gespeichert.', 'success');
      await refetchMedications();
    },
    onError: () => addToast('Medikament konnte nicht gespeichert werden.', 'error'),
  });

  const createVital = trpc.medical.vitals.create.useMutation({
    onSuccess: async () => {
      setShowVitalsForm(false);
      resetVitForm();
      addToast('Vitalzeichen gespeichert.', 'success');
      await refetchVitals();
    },
    onError: () => addToast('Vitalzeichen konnten nicht gespeichert werden.', 'error'),
  });

  const updateAllergies = trpc.medical.allergies.update.useMutation({
    onSuccess: async () => {
      setShowAllergiesForm(false);
      addToast('Allergien aktualisiert.', 'success');
    },
    onError: () => addToast('Allergien konnten nicht aktualisiert werden.', 'error'),
  });

  const createVaccination = trpc.vaccinations.create.useMutation({
    onSuccess: async () => {
      setShowVaccinationForm(false);
      resetVaccinationForm();
      addToast('Impfung erfasst.', 'success');
      await refetchVaccinations();
    },
    onError: () => addToast('Impfung konnte nicht gespeichert werden.', 'error'),
  });

  const updateVaccination = trpc.vaccinations.update.useMutation({
    onSuccess: async () => {
      setShowVaccinationForm(false);
      setEditingVaccinationId(null);
      resetVaccinationForm();
      addToast('Impfung aktualisiert.', 'success');
      await refetchVaccinations();
    },
    onError: () => addToast('Impfung konnte nicht aktualisiert werden.', 'error'),
  });

  const deleteVaccination = trpc.vaccinations.delete.useMutation({
    onSuccess: async () => {
      setDeletingVaccinationId(null);
      addToast('Impfung gelöscht.', 'success');
      await refetchVaccinations();
    },
    onError: () => addToast('Impfung konnte nicht gelöscht werden.', 'error'),
  });

  // ── Form helpers ───────────────────────────────────────────────────────────

  const resetDxForm = () => {
    setDxTitle(''); setDxDescription(''); setDxIcd10('');
    setDxSeverity(''); setDxStatus('active');
    setDxDate(new Date().toISOString().split('T')[0]);
  };
  const resetMedForm = () => {
    setMedName(''); setMedDosage(''); setMedFrequency('');
    setMedRoute('oral'); setMedStartDate(new Date().toISOString().split('T')[0]);
    setMedEndDate(''); setMedNotes(''); setMedDiagnosisId('');
  };
  const resetVitForm = () => {
    setVitWeight(''); setVitTemp(''); setVitHr(''); setVitRr('');
    setVitNotes(''); setVitDate(new Date().toISOString().split('T')[0]);
  };
  const resetVaccinationForm = () => {
    setVaccinationTypeId(''); setVaccinationCustomType('');
    setVaccinationDate(''); setVaccinationExpiry('');
    setVaccinationBatch(''); setVaccinationNotes('');
  };

  const handleVacTypeChange = (typeId: string) => {
    setVaccinationTypeId(typeId);
    if (typeId === 'custom') return;
    const vt = allVacTypes?.find((t) => t.id === typeId);
    if (vt && vaccinationDate) {
      const expiry = new Date(vaccinationDate);
      expiry.setMonth(expiry.getMonth() + vt.defaultIntervalMonths);
      setVaccinationExpiry(expiry.toISOString().split('T')[0]);
    }
  };

  const handleVacDateChange = (dateStr: string) => {
    setVaccinationDate(dateStr);
    if (!vaccinationTypeId || vaccinationTypeId === 'custom') return;
    const vt = allVacTypes?.find((t) => t.id === vaccinationTypeId);
    if (vt && dateStr) {
      const expiry = new Date(dateStr);
      expiry.setMonth(expiry.getMonth() + vt.defaultIntervalMonths);
      setVaccinationExpiry(expiry.toISOString().split('T')[0]);
    }
  };

  type VaccinationRow = NonNullable<typeof vaccinationsList>[number];
  const openEditVaccinationDialog = (v: VaccinationRow) => {
    setEditingVaccinationId(v.id);
    setVaccinationTypeId(v.vaccinationTypeId ?? 'custom');
    setVaccinationCustomType(v.vaccinationTypeId ? '' : v.type);
    setVaccinationDate(new Date(v.administeredDate).toISOString().split('T')[0]);
    setVaccinationExpiry(new Date(v.expiryDate).toISOString().split('T')[0]);
    setVaccinationBatch(v.batchNumber ?? '');
    setVaccinationNotes(v.notes ?? '');
    setShowVaccinationForm(true);
  };

  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-DE', { year: '2-digit', month: '2-digit', day: '2-digit' });
  };

  // ── Loading / not-found ────────────────────────────────────────────────────

  if (isLoading) {
    return <div className="text-center py-12 text-muted">Wird geladen…</div>;
  }
  if (!patient) {
    return <div className="text-center py-12 text-red-600">Tier nicht gefunden</div>;
  }

  const activeMeds = medicationsList?.filter((m) => !m.endDate) || [];
  const activeDiagnoses = diagnosisList?.filter((d) => d.status === 'active') || [];
  const latestVital = vitalsList?.[vitalsList.length - 1];
  const patientAllergies = (patient as { allergies?: string | null }).allergies;

  // Diagnosis options for medication linking
  const diagnosisOptions = (diagnosisList ?? []).map((d) => ({
    value: d.id,
    label: `${d.title} (${STATUS_LABELS[d.status] ?? d.status})`,
  }));

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/patients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        <ChevronLeft size={16} /> Zurück zu Tieren
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-fg">{patient.name}</h1>
          <p className="text-muted mt-1">
            {patient.species}
            {patient.breed && ` · ${patient.breed}`}
          </p>
        </div>
        <div className="text-right space-y-0.5 shrink-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Tierhalter</div>
          <Link
            href={`/dashboard/clients/${patient.ownerId}`}
            className="font-semibold text-fg hover:text-[var(--color-accent)] hover:underline block"
          >
            {[patient.ownerFirstName, patient.ownerLastName].filter(Boolean).join(' ') || '—'}
          </Link>
          {patient.ownerPhone && (
            <a href={`tel:${patient.ownerPhone}`} className="text-sm text-[var(--color-accent)] hover:underline block">
              {patient.ownerPhone}
            </a>
          )}
          {patient.ownerEmail && (
            <a href={`mailto:${patient.ownerEmail}`} className="text-sm text-[var(--color-accent)] hover:underline block">
              {patient.ownerEmail}
            </a>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-4">
          <p className="text-xs text-muted font-medium">Gewicht</p>
          <p className="text-2xl font-bold text-fg mt-1">
            {patient.weight ? (patient.weight / 1000).toFixed(1) : '–'} kg
          </p>
          {latestVital?.weight && (
            <p className="text-xs text-muted mt-1">Letzte Messung: {formatDate(latestVital.recordedAt)}</p>
          )}
        </div>
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-4">
          <p className="text-xs text-muted font-medium">Farbe</p>
          <p className="text-lg font-semibold text-fg mt-1">{patient.color || '–'}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-4">
          <p className="text-xs text-muted font-medium">Aktive Diagnosen</p>
          <p className="text-2xl font-bold text-fg mt-1">{activeDiagnoses.length}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-4">
          <p className="text-xs text-muted font-medium">Medikamente</p>
          <p className="text-2xl font-bold text-fg mt-1">{activeMeds.length}</p>
        </div>
      </div>

      {/* Allergies alert */}
      {patientAllergies && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Allergien</h3>
              <p className="text-red-800 mt-1 text-sm">{patientAllergies}</p>
            </div>
          </div>
          <button
            onClick={() => { setAllergiesText(patientAllergies); setShowAllergiesForm(true); }}
            className="shrink-0 p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
            title="Allergien bearbeiten"
          >
            <Pencil size={14} />
          </button>
        </div>
      )}
      {!patientAllergies && (
        <button
          onClick={() => { setAllergiesText(''); setShowAllergiesForm(true); }}
          className="text-xs text-muted hover:text-fg transition-colors flex items-center gap-1"
        >
          <Plus size={12} /> Allergien erfassen
        </button>
      )}

      {/* Diagnoses + Medications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Diagnoses */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-bold text-fg flex items-center gap-2">
              <Stethoscope size={16} style={{ color: 'var(--color-accent)' }} />
              Diagnosen
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowDiagnosisForm(true)} data-testid="add-diagnosis-button">
              <Plus size={14} /> Hinzufügen
            </Button>
          </div>
          <div className="p-6">
            {diagnosisList && diagnosisList.length > 0 ? (
              <div className="space-y-3">
                {diagnosisList.map((dx) => (
                  <div key={dx.id} className="rounded-xl border border-border bg-bg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-fg">{dx.title}</p>
                        {dx.icd10Code && (
                          <p className="text-xs font-mono text-muted mt-0.5">{dx.icd10Code}</p>
                        )}
                        {dx.description && (
                          <p className="text-sm text-muted mt-1">{dx.description}</p>
                        )}
                        <p className="text-xs text-muted mt-2">
                          {formatDate(dx.dateOfDiagnosis)}
                          {dx.severity && ` · ${SEVERITY_LABELS[dx.severity] ?? dx.severity}`}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium shrink-0 ${
                          dx.status === 'active'
                            ? 'bg-yellow-100 text-yellow-800'
                            : dx.status === 'resolved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {STATUS_LABELS[dx.status] ?? dx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-center py-8">Keine Diagnosen erfasst</p>
            )}
          </div>
        </div>

        {/* Medications */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-bold text-fg flex items-center gap-2">
              <Pill size={16} style={{ color: 'var(--color-accent)' }} />
              Medikamente
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowMedicationForm(true)}>
              <Plus size={14} /> Hinzufügen
            </Button>
          </div>
          <div className="p-6">
            {medicationsList && medicationsList.length > 0 ? (
              <div className="space-y-3">
                {medicationsList.map((med) => (
                  <div key={med.id} className={`rounded-xl border bg-bg p-3 ${med.endDate ? 'border-border opacity-60' : 'border-border'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-fg">{med.medicationName}</p>
                        <p className="text-sm text-muted mt-1">
                          {med.dosage} · {med.frequency} · {med.route ? (ROUTE_LABELS[med.route] ?? med.route) : ''}
                        </p>
                        <p className="text-xs text-muted mt-2">
                          Ab {formatDate(med.startDate)}
                          {med.endDate && ` bis ${formatDate(med.endDate)}`}
                        </p>
                        {med.notes && <p className="text-xs text-muted mt-1 italic">{med.notes}</p>}
                      </div>
                      {med.endDate ? (
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-muted-soft text-muted shrink-0">Beendet</span>
                      ) : (
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-800 shrink-0">Aktiv</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-center py-8">Keine Medikamente erfasst</p>
            )}
          </div>
        </div>
      </div>

      {/* Appointments */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-fg flex items-center gap-2">
            <Calendar size={16} style={{ color: 'var(--color-accent)' }} />
            Termine
          </h2>
        </div>
        <div className="p-6">
          {appointmentsList && appointmentsList.length > 0 ? (
            <div className="space-y-3">
              {appointmentsList.map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => { setSelectedAptId(apt.id); setApptModalOpen(true); }}
                  className="w-full text-left rounded-xl border border-border bg-bg p-3 hover:bg-muted-soft transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-fg">{apt.title}</p>
                      <p className="text-sm text-muted mt-1 flex items-center gap-2">
                        <Clock size={13} />
                        {new Date(apt.startTime).toLocaleDateString('de-DE', {
                          weekday: 'short', day: '2-digit', month: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      {apt.vetFirstName && apt.vetLastName && (
                        <p className="text-sm mt-1 font-medium" style={{ color: 'var(--color-accent)' }}>
                          Dr. {apt.vetFirstName} {apt.vetLastName}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium shrink-0 ${
                      apt.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800'
                        : apt.status === 'completed' ? 'bg-green-100 text-green-800'
                        : apt.status === 'cancelled' ? 'bg-red-100 text-red-800'
                        : 'bg-muted-soft text-muted'
                    }`}>
                      {apt.status === 'scheduled' && 'Geplant'}
                      {apt.status === 'completed' && 'Abgeschlossen'}
                      {apt.status === 'cancelled' && 'Abgesagt'}
                      {apt.status === 'no-show' && 'Nicht erschienen'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted text-center py-8">Keine Termine erfasst</p>
          )}
        </div>
      </div>

      {/* Vitals */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-fg flex items-center gap-2">
            <TrendingDown size={16} style={{ color: 'var(--color-accent)' }} />
            Vitalzeichen & Gewicht
          </h2>
          <Button size="sm" variant="outline" onClick={() => setShowVitalsForm(true)}>
            <Plus size={14} /> Messung hinzufügen
          </Button>
        </div>
        <div className="p-6">
          {vitalsList && vitalsList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-3 font-semibold text-fg">Datum</th>
                    <th className="text-left py-2 px-3 font-semibold text-fg">Gewicht</th>
                    <th className="text-left py-2 px-3 font-semibold text-fg">Temperatur</th>
                    <th className="text-left py-2 px-3 font-semibold text-fg">Puls</th>
                    <th className="text-left py-2 px-3 font-semibold text-fg">Atemf.</th>
                    <th className="text-left py-2 px-3 font-semibold text-fg">Notizen</th>
                  </tr>
                </thead>
                <tbody>
                  {vitalsList.map((vital) => (
                    <tr key={vital.id} className="border-b border-border hover:bg-muted-soft transition-colors">
                      <td className="py-3 px-3 text-fg">{formatDate(vital.recordedAt)}</td>
                      <td className="py-3 px-3 text-fg">
                        {vital.weight ? (vital.weight / 1000).toFixed(1) : '–'} kg
                      </td>
                      <td className="py-3 px-3 text-fg">{vital.temperature || '–'}</td>
                      <td className="py-3 px-3 text-fg">{vital.heartRate ? `${vital.heartRate} bpm` : '–'}</td>
                      <td className="py-3 px-3 text-fg">{vital.respiratoryRate ? `${vital.respiratoryRate} /min` : '–'}</td>
                      <td className="py-3 px-3 text-muted text-xs">{vital.notes || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted text-center py-8">Keine Vitalzeichen erfasst</p>
          )}
        </div>
      </div>

      {/* Vaccination history */}
      <div id="impfhistorie" className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-bold text-fg">Impfhistorie</h2>
            <p className="text-xs text-muted mt-0.5">
              Anstehende Booster (90 Tage): {upcomingVaccinations?.length ?? 0}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowVaccinationForm(true)}>
            <Plus size={14} /> Impfung hinzufügen
          </Button>
        </div>
        <div className="p-6">
          {vaccinationsList && vaccinationsList.length > 0 ? (
            <div className="space-y-2">
              {vaccinationsList.map((v) => {
                const now = new Date();
                const expiry = new Date(v.expiryDate);
                const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
                const isOverdue = expiry < now;
                const isDueSoon = !isOverdue && daysLeft <= 30;
                return (
                  <div key={v.id} className="flex items-start justify-between rounded-xl border border-border bg-bg p-3 shadow-sm group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-fg text-sm">{v.type}</span>
                        {v.typeCategory && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            v.typeCategory === 'core' ? 'bg-blue-100 text-blue-700'
                              : v.typeCategory === 'recommended' ? 'bg-amber-100 text-amber-700'
                              : 'bg-muted-soft text-muted'
                          }`}>
                            {v.typeCategory === 'core' ? 'Core' : v.typeCategory === 'recommended' ? 'Empfohlen' : 'Optional'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-1">
                        Verabreicht: {formatDate(v.administeredDate)}
                        {v.vetFirstName && ` · ${v.vetFirstName} ${v.vetLastName ?? ''}`}
                        {v.batchNumber && ` · Charge: ${v.batchNumber}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-green-600'}`}>
                        {isOverdue ? `Überfällig seit ${Math.abs(daysLeft)} T.`
                          : isDueSoon ? `Fällig in ${daysLeft} T.`
                          : formatDate(v.expiryDate)}
                      </span>
                      <button
                        onClick={() => openEditVaccinationDialog(v)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted-soft text-muted hover:text-fg"
                        title="Bearbeiten"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingVaccinationId(v.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-muted hover:text-red-600"
                        title="Löschen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted text-center py-8 text-sm">Keine Impfungen erfasst</p>
          )}
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Appointment modal */}
      {tenantId && (
        <AppointmentModal
          open={apptModalOpen}
          onClose={() => { setApptModalOpen(false); setSelectedAptId(null); }}
          tenantId={tenantId}
          onSuccess={() => { setApptModalOpen(false); setSelectedAptId(null); }}
          editData={(() => {
            const apt = appointmentsList?.find((a) => a.id === selectedAptId);
            if (!apt || !apt.vetId) return undefined;
            return {
              id: apt.id, title: apt.title, description: apt.description ?? null,
              startTime: new Date(apt.startTime), endTime: new Date(apt.endTime),
              status: apt.status, patientId: apt.patientId, vetId: apt.vetId,
              patientName: patient.name,
            };
          })()}
        />
      )}

      {/* Diagnosis dialog */}
      <Dialog open={showDiagnosisForm} onOpenChange={(o) => { setShowDiagnosisForm(o); if (!o) resetDxForm(); }}>
        <DialogContent data-testid="medical-record-modal">
          <DialogHeader><DialogTitle>Diagnose erfassen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <label className="block text-sm text-fg">
              Bezeichnung *
              <input
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="z.B. Otitis externa"
                value={dxTitle}
                onChange={(e) => setDxTitle(e.target.value)}
              />
            </label>
            <label className="block text-sm text-fg">
              ICD-10 Code
              <input
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm font-mono text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="z.B. H60.0"
                value={dxIcd10}
                onChange={(e) => setDxIcd10(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-fg">
                Schweregrad
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  value={dxSeverity}
                  onChange={(e) => setDxSeverity(e.target.value as typeof dxSeverity)}
                >
                  <option value="">—</option>
                  <option value="mild">Leicht</option>
                  <option value="moderate">Mittel</option>
                  <option value="severe">Schwer</option>
                </select>
              </label>
              <label className="block text-sm text-fg">
                Status
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  value={dxStatus}
                  onChange={(e) => setDxStatus(e.target.value as typeof dxStatus)}
                >
                  <option value="active">Aktiv</option>
                  <option value="monitoring">Beobachtung</option>
                  <option value="resolved">Geheilt</option>
                </select>
              </label>
            </div>
            <label className="block text-sm text-fg">
              Datum der Diagnose *
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={dxDate}
                onChange={(e) => setDxDate(e.target.value)}
              />
            </label>
            <label className="block text-sm text-fg">
              Beschreibung
              <textarea
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="Klinische Befunde, Verlauf…"
                value={dxDescription}
                onChange={(e) => setDxDescription(e.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDiagnosisForm(false); resetDxForm(); }}>Abbrechen</Button>
            <Button
              loading={createDiagnosis.isPending}
              disabled={!dxTitle || !dxDate}
              onClick={() => {
                if (!tenantId || !dxTitle || !dxDate) return;
                createDiagnosis.mutate({
                  tenantId, patientId,
                  title: dxTitle,
                  description: dxDescription || undefined,
                  icd10Code: dxIcd10 || undefined,
                  severity: dxSeverity || undefined,
                  status: dxStatus,
                  dateOfDiagnosis: new Date(dxDate),
                });
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Medication dialog */}
      <Dialog open={showMedicationForm} onOpenChange={(o) => { setShowMedicationForm(o); if (!o) resetMedForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Medikament erfassen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <label className="block text-sm text-fg">
              Medikamentenname *
              <input
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="z.B. Amoxicillin"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-fg">
                Dosierung *
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  placeholder="z.B. 250 mg"
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                />
              </label>
              <label className="block text-sm text-fg">
                Häufigkeit *
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  placeholder="z.B. 2x täglich"
                  value={medFrequency}
                  onChange={(e) => setMedFrequency(e.target.value)}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-fg">
                Verabreichungsweg
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  value={medRoute}
                  onChange={(e) => setMedRoute(e.target.value as typeof medRoute)}
                >
                  <option value="oral">Oral</option>
                  <option value="injection">Injektion</option>
                  <option value="topical">Topisch</option>
                  <option value="ophthalmic">Augen</option>
                  <option value="other">Sonstiges</option>
                </select>
              </label>
              <label className="block text-sm text-fg">
                Start *
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  value={medStartDate}
                  onChange={(e) => setMedStartDate(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-sm text-fg">
              Ende (optional)
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={medEndDate}
                onChange={(e) => setMedEndDate(e.target.value)}
              />
            </label>
            {diagnosisOptions.length > 0 && (
              <div>
                <p className="text-sm text-fg mb-1">Diagnose verknüpfen</p>
                <SearchableSelect
                  label=""
                  placeholder="Diagnose auswählen (optional)"
                  value={medDiagnosisId}
                  onChange={setMedDiagnosisId}
                  options={[{ value: '', label: '— Keine —' }, ...diagnosisOptions]}
                />
              </div>
            )}
            <label className="block text-sm text-fg">
              Notizen
              <textarea
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="Hinweise zur Einnahme…"
                value={medNotes}
                onChange={(e) => setMedNotes(e.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowMedicationForm(false); resetMedForm(); }}>Abbrechen</Button>
            <Button
              loading={createMedication.isPending}
              disabled={!medName || !medDosage || !medFrequency || !medStartDate}
              onClick={() => {
                if (!tenantId || !medName || !medDosage || !medFrequency || !medStartDate) return;
                createMedication.mutate({
                  tenantId, patientId,
                  medicationName: medName,
                  dosage: medDosage,
                  frequency: medFrequency,
                  route: medRoute,
                  startDate: new Date(medStartDate),
                  endDate: medEndDate ? new Date(medEndDate) : undefined,
                  diagnosisId: medDiagnosisId || undefined,
                  notes: medNotes || undefined,
                });
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vitals dialog */}
      <Dialog open={showVitalsForm} onOpenChange={(o) => { setShowVitalsForm(o); if (!o) resetVitForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vitalzeichen erfassen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <label className="block text-sm text-fg">
              Datum der Messung *
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={vitDate}
                onChange={(e) => setVitDate(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-fg">
                Gewicht (g)
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  placeholder="z.B. 4500"
                  value={vitWeight}
                  onChange={(e) => setVitWeight(e.target.value)}
                />
              </label>
              <label className="block text-sm text-fg">
                Temperatur
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  placeholder="z.B. 38.5°C"
                  value={vitTemp}
                  onChange={(e) => setVitTemp(e.target.value)}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-fg">
                Puls (bpm)
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  placeholder="z.B. 80"
                  value={vitHr}
                  onChange={(e) => setVitHr(e.target.value)}
                />
              </label>
              <label className="block text-sm text-fg">
                Atemfrequenz (/min)
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  placeholder="z.B. 20"
                  value={vitRr}
                  onChange={(e) => setVitRr(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-sm text-fg">
              Notizen
              <textarea
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="Optionale Anmerkungen"
                value={vitNotes}
                onChange={(e) => setVitNotes(e.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowVitalsForm(false); resetVitForm(); }}>Abbrechen</Button>
            <Button
              loading={createVital.isPending}
              disabled={!vitDate || (!vitWeight && !vitTemp && !vitHr && !vitRr)}
              onClick={() => {
                if (!tenantId || !vitDate) return;
                createVital.mutate({
                  tenantId, patientId,
                  recordedAt: new Date(vitDate),
                  weight: vitWeight ? parseInt(vitWeight, 10) : undefined,
                  temperature: vitTemp || undefined,
                  heartRate: vitHr ? parseInt(vitHr, 10) : undefined,
                  respiratoryRate: vitRr ? parseInt(vitRr, 10) : undefined,
                  notes: vitNotes || undefined,
                });
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allergies dialog */}
      <Dialog open={showAllergiesForm} onOpenChange={(o) => { setShowAllergiesForm(o); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Allergien bearbeiten</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <label className="block text-sm text-fg">
              Allergien
              <textarea
                rows={3}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                placeholder="z.B. Penicillin, Flohspeichel"
                value={allergiesText}
                onChange={(e) => setAllergiesText(e.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAllergiesForm(false)}>Abbrechen</Button>
            <Button
              loading={updateAllergies.isPending}
              onClick={() => {
                if (!tenantId) return;
                updateAllergies.mutate({
                  tenantId, patientId,
                  allergies: allergiesText || undefined,
                });
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vaccination dialog */}
      <Dialog open={showVaccinationForm} onOpenChange={(open) => { setShowVaccinationForm(open); if (!open) { resetVaccinationForm(); setEditingVaccinationId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVaccinationId ? 'Impfung bearbeiten' : 'Impfung erfassen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const speciesTypes = (allVacTypes ?? []).filter((t) =>
                patient?.species ? t.species.toLowerCase().includes(patient.species.toLowerCase()) : true
              );
              const typeOptions = [
                ...speciesTypes.map((t) => ({ value: t.id, label: t.name, searchText: `${t.code} ${t.category}` })),
                { value: 'custom', label: 'Sonstiges (frei eingeben)' },
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
                  {vaccinationTypeId === 'custom' && (
                    <label className="block text-sm text-fg">
                      Bezeichnung *
                      <input
                        className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        placeholder="z.B. Combo XY"
                        value={vaccinationCustomType}
                        onChange={(e) => setVaccinationCustomType(e.target.value)}
                      />
                    </label>
                  )}
                  {selectedVt && (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700 space-y-0.5">
                      <div className="font-semibold">{selectedVt.name} ({selectedVt.code})</div>
                      <div>Standardintervall: {selectedVt.defaultIntervalMonths} Monate · {selectedVt.category === 'core' ? 'Core-Impfung' : selectedVt.category === 'recommended' ? 'Empfohlen' : 'Optional'}</div>
                      {selectedVt.notes && <div className="text-blue-600">{selectedVt.notes}</div>}
                      {selectedVt.requiresBatchNumber && (
                        <div className="font-semibold text-amber-700">⚠ Chargennummer erforderlich</div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
            <label className="block text-sm text-fg">
              Verabreicht am *
              <input type="date" className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" value={vaccinationDate} onChange={(e) => handleVacDateChange(e.target.value)} />
            </label>
            <label className="block text-sm text-fg">
              Fällig am (Auffrischung) *
              <input type="date" className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" value={vaccinationExpiry} onChange={(e) => setVaccinationExpiry(e.target.value)} />
            </label>
            <label className="block text-sm text-fg">
              Chargennummer
              <input className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" placeholder="z.B. B2024-001" value={vaccinationBatch} onChange={(e) => setVaccinationBatch(e.target.value)} />
            </label>
            <label className="block text-sm text-fg">
              Notizen
              <textarea rows={2} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" placeholder="Optionale Anmerkungen" value={vaccinationNotes} onChange={(e) => setVaccinationNotes(e.target.value)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowVaccinationForm(false); setEditingVaccinationId(null); resetVaccinationForm(); }}>Abbrechen</Button>
            <Button
              loading={createVaccination.isPending || updateVaccination.isPending}
              disabled={!vaccinationTypeId || (vaccinationTypeId === 'custom' && !vaccinationCustomType) || !vaccinationDate || !vaccinationExpiry}
              onClick={() => {
                const selectedType = allVacTypes?.find((t) => t.id === vaccinationTypeId);
                const resolvedName = vaccinationTypeId === 'custom' ? vaccinationCustomType : (selectedType?.name ?? '');
                if (!tenantId || !resolvedName || !vaccinationDate || !vaccinationExpiry) return;
                const globalTypeId = selectedType?.source === 'global' ? selectedType.id : null;
                const customConfigId = selectedType?.source === 'custom' ? selectedType.id : null;
                if (editingVaccinationId) {
                  updateVaccination.mutate({ tenantId, vaccinationId: editingVaccinationId, vaccinationTypeId: globalTypeId, tenantVaccinationTypeConfigId: customConfigId, type: resolvedName, administeredDate: new Date(vaccinationDate), expiryDate: new Date(vaccinationExpiry), batchNumber: vaccinationBatch || null, notes: vaccinationNotes || null });
                } else {
                  createVaccination.mutate({ tenantId, patientId, vaccinationTypeId: globalTypeId ?? undefined, tenantVaccinationTypeConfigId: customConfigId ?? undefined, type: resolvedName, administeredDate: new Date(vaccinationDate), expiryDate: new Date(vaccinationExpiry), batchNumber: vaccinationBatch || undefined, notes: vaccinationNotes || undefined });
                }
              }}
            >
              {editingVaccinationId ? 'Aktualisieren' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete vaccination confirmation */}
      <Dialog open={!!deletingVaccinationId} onOpenChange={(open) => { if (!open) setDeletingVaccinationId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Impfung löschen?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted">Diese Aktion kann nicht rückgängig gemacht werden.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingVaccinationId(null)}>Abbrechen</Button>
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
    </div>
  );
}
