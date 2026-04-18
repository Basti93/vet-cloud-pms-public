'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@clerk/nextjs';
import { Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/hooks/useTenant';
import { useCurrentVet } from '@/hooks/useCurrentVet';
import { TableFilters, type FilterState } from '@/components/appointments/TableFilters';
import { AppointmentTable } from '@/components/appointments/AppointmentTable';

export default function AppointmentsPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const { tenantId } = useTenant();
  const vetId = useCurrentVet();
  const [filters, setFilters] = useState<FilterState>({
    vetId: vetId || null,
    status: null,
    dateFrom: '',
    dateTo: '',
  });

  // Auto-set filter to current vet if they are a vet
  useEffect(() => {
    if (vetId && !filters.vetId) {
      setFilters((prev) => ({ ...prev, vetId }));
    }
  }, [vetId]);

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
        <TableFilters
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

        {/* Appointments Table */}
        <AppointmentTable
          items={filteredAppointments}
          vets={vets || []}
          loading={isFetching}
          showActions={false}
        />
      </div>
    </div>
  );
}
