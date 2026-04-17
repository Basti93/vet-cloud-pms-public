'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ChevronLeft,
  Plus,
  Pill,
  Stethoscope,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Edit2,
} from 'lucide-react';
import Link from 'next/link';

export default function PatientDetailPage() {
  const params = useParams();
  const patientId = params.patientId as string;
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [showVitalsForm, setShowVitalsForm] = useState(false);

  // Get demo tenant ID
  const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000003";

  // Fetch patient data
  const { data: patients, isLoading } = trpc.patients.list.useQuery({
    tenantId: DEMO_TENANT_ID,
  });
  const patient = patients?.find((p) => p.id === patientId);

  // Fetch medical data
  const { data: diagnosisList } = trpc.medical.diagnoses.list.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const { data: medicationsList } = trpc.medical.medications.list.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const { data: vitalsList } = trpc.medical.vitals.list.useQuery(
    { patientId },
    { enabled: !!patientId }
  );

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!patient) {
    return <div className="text-center py-12 text-red-600">Patient not found</div>;
  }

  const allergies = patient.allergies
    ? patient.allergies.split(',').map((a) => a.trim())
    : [];
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
          <div className="text-right">
            <div className="text-sm text-gray-600">Owner</div>
            <div className="font-semibold text-gray-900">Besitzer-Info</div>
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
      </div>

      {/* Placeholder for Forms */}
      {(showDiagnosisForm || showMedicationForm || showVitalsForm) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <p className="text-gray-600">Forms coming in next iteration...</p>
          </div>
        </div>
      )}
    </div>
  );
}
