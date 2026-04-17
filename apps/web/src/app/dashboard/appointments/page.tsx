'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@clerk/nextjs';
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  AppointmentFilters,
  type AppointmentFiltersState,
} from '@/components/appointments/AppointmentFilters';

export default function AppointmentsPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [filters, setFilters] = useState<AppointmentFiltersState>({
    vetId: null,
    status: null,
    dateFrom: '',
    dateTo: '',
  });

  // Get tenant ID
  useEffect(() => {
    const demoTenantId = '00000000-0000-4000-8000-000000000003';
    setTenantId(demoTenantId);
  }, [userId]);

  // Fetch appointments with details
  const { data: appointments, isLoading: isFetching } =
    trpc.appointments.listWithDetails.useQuery(
      {
        tenantId: tenantId || '',
        from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
        to: filters.dateTo ? new Date(filters.dateTo) : undefined,
      },
      { enabled: !!tenantId && !!userId }
    );

  // Fetch all vets for the FilterBar
  const { data: vets } = trpc.vet.list.useQuery(
    { tenantId: tenantId || '' },
    { enabled: !!tenantId && !!userId }
  );

  if (!userId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Bitte melden Sie sich an.</p>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Praxis-ID nicht gefunden.</p>
      </div>
    );
  }

  // Filter appointments based on selected filters
  const filteredAppointments = (appointments || []).filter((apt) => {
    if (filters.vetId && apt.vetId !== filters.vetId) return false;
    if (filters.status && apt.status !== filters.status) return false;
    return true;
  });

  // Group by vet for display
  const appointmentsByVet = vets?.reduce(
    (acc, vet) => {
      const vetAppointments = filteredAppointments.filter(
        (apt) => apt.vetId === vet.id
      );
      return { ...acc, [vet.id]: vetAppointments };
    },
    {} as Record<string, (typeof filteredAppointments)[0][]>
  );

  // Calculate stats
  const stats = {
    total: filteredAppointments.length,
    scheduled: filteredAppointments.filter((a) => a.status === 'scheduled').length,
    completed: filteredAppointments.filter((a) => a.status === 'completed').length,
    cancelled: filteredAppointments.filter((a) => a.status === 'cancelled').length,
    noShow: filteredAppointments.filter((a) => a.status === 'no-show').length,
  };

  const formatDateTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'no-show':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Geplant';
      case 'completed':
        return 'Abgeschlossen';
      case 'cancelled':
        return 'Abgelehnt';
      case 'no-show':
        return 'Nicht erschienen';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Termine</h1>
          <p className="text-gray-600 mt-1">
            {appointments ? `${appointments.length} Termine geladen` : 'Terminübersicht'}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <AppointmentFilters
            tenantId={tenantId}
            userId={userId}
            filters={filters}
            onChange={setFilters}
            onReset={() =>
              setFilters({
                vetId: null,
                status: null,
                dateFrom: '',
                dateTo: '',
              })
            }
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs font-medium text-gray-600 mb-1">Gesamt</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-400">
            <p className="text-xs font-medium text-gray-600 mb-1">Geplant</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.scheduled}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-400">
            <p className="text-xs font-medium text-gray-600 mb-1">Abgeschlossen</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-400">
            <p className="text-xs font-medium text-gray-600 mb-1">Abgelehnt</p>
            <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
            <p className="text-xs font-medium text-gray-600 mb-1">Nicht erschienen</p>
            <p className="text-2xl font-bold text-gray-600">{stats.noShow}</p>
          </div>
        </div>

        {/* Vet Sections */}
        {vets && vets.length > 0 ? (
          <div className="space-y-8">
            {vets.map((vet) => {
              const vetAppts = appointmentsByVet?.[vet.id] || [];
              if (filters.vetId && vet.id !== filters.vetId) return null;

              return (
                <div key={vet.id} className="bg-white rounded-lg shadow">
                  {/* Vet Header */}
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          Dr. {vet.firstName} {vet.lastName}
                        </h2>
                        <p className="text-sm text-gray-600">{vet.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-indigo-600">
                          {vetAppts.length}
                        </p>
                        <p className="text-xs text-gray-600">Termine</p>
                      </div>
                    </div>
                  </div>

                  {/* Appointments Table */}
                  {vetAppts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                              Datum/Zeit
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                              Grund
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                              Patient
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                              Besitzer
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                              Quelle
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {vetAppts.map((apt) => (
                            <tr
                              key={apt.id}
                              className="hover:bg-gray-50 cursor-pointer"
                              onClick={() =>
                                router.push(
                                  `/dashboard/appointments/${apt.id}`
                                )
                              }
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {formatDateTime(apt.startTime)}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-gray-900">
                                  {apt.title}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                    <span className="text-xs font-semibold text-indigo-600">
                                      {apt.patientSpecies
                                        ?.charAt(0)
                                        .toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {apt.patientName}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      {apt.ownerFirstName} {apt.ownerLastName}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {apt.ownerPhone}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-gray-600">
                                  {apt.source === 'online_booking'
                                    ? 'Online'
                                    : apt.source === 'voice_ai'
                                    ? 'Anruf'
                                    : 'Manuell'}
                                </p>
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                    apt.status
                                  )}`}
                                >
                                  {apt.status === 'scheduled' && (
                                    <AlertCircle className="w-3 h-3" />
                                  )}
                                  {apt.status === 'completed' && (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                  {apt.status === 'cancelled' && (
                                    <XCircle className="w-3 h-3" />
                                  )}
                                  {apt.status === 'no-show' && (
                                    <AlertCircle className="w-3 h-3" />
                                  )}
                                  {getStatusLabel(apt.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-6 py-8 text-center">
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600 text-sm">
                        Keine Termine für diesen Arzt
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : isFetching ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Laden...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Keine Termine gefunden</p>
          </div>
        )}
      </div>
    </div>
  );
}
