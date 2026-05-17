'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@clerk/nextjs';
import { useTenant } from '@/hooks/useTenant';
import { TableFilters, type FilterState } from '@/components/appointments/TableFilters';
import { AppointmentTable } from '@/components/appointments/AppointmentTable';
import { AppointmentModal } from '@/components/appointments/AppointmentModal';
import { Card } from '@/components/ui/card';
import type { AppointmentType } from '@/components/appointments/AppointmentTable';

export default function AppointmentsPage() {
  type EditableAppointment = {
    id: string;
    title: string;
    description: string | null;
    startTime: Date | string;
    endTime: Date | string;
    status: string;
    patientId: string;
    vetId: string;
    patientName?: string | null;
  };
  const { userId } = useAuth();
  const { tenantId } = useTenant();
  const [filters, setFilters] = useState<FilterState>({
    vetId: null,
    status: null,
    dateFrom: '',
    dateTo: '',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentType | null>(null);

  const isEditableSource = (item: AppointmentType): item is EditableSource =>
    'title' in item && 'patientId' in item && typeof item.patientId === 'string';

  const toEditableAppointment = (item: AppointmentType | null): EditableAppointment | null => {
    if (!item) return null;
    if (!isEditableSource(item)) return null;

    return {
      id: item.id,
      title: item.title,
      description: item.description ?? null,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status,
      patientId: item.patientId,
      vetId: item.vetId,
      patientName: item.patientName ?? null,
    };
  };

  // Fetch appointments with details
  const { data: appointments, isLoading: isFetching, refetch: refetchAppointments } =
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
        <p className="text-muted">Bitte melden Sie sich an.</p>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">Praxis-ID nicht gefunden.</p>
      </div>
    );
  }

  // Filter appointments based on selected filters
  const filteredAppointments = (appointments || []).filter((apt) => {
    if (filters.vetId && apt.vetId !== filters.vetId) return false;
    if (filters.status && apt.status !== filters.status) return false;
    return true;
  });

  // Calculate stats
  const stats = {
    total: filteredAppointments.length,
    scheduled: filteredAppointments.filter((a) => a.status === 'scheduled').length,
    completed: filteredAppointments.filter((a) => a.status === 'completed').length,
    cancelled: filteredAppointments.filter((a) => a.status === 'cancelled').length,
    noShow: filteredAppointments.filter((a) => a.status === 'no-show').length,
  };


  return (
    <div data-testid="appointments-page" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-fg">Termine</h1>
        <p className="text-muted mt-1">
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted mb-1">Gesamt</p>
          <p className="text-2xl font-bold text-fg">{stats.total}</p>
        </Card>
        <Card className="p-4 border-l-4 border-yellow-400">
          <p className="text-xs font-medium text-muted mb-1">Geplant</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.scheduled}</p>
        </Card>
        <Card className="p-4 border-l-4 border-green-400">
          <p className="text-xs font-medium text-muted mb-1">Abgeschlossen</p>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </Card>
        <Card className="p-4 border-l-4 border-red-400">
          <p className="text-xs font-medium text-muted mb-1">Abgelehnt</p>
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
        </Card>
        <Card className="p-4 border-l-4 border-gray-400">
          <p className="text-xs font-medium text-muted mb-1">Nicht erschienen</p>
          <p className="text-2xl font-bold text-muted">{stats.noShow}</p>
        </Card>
      </div>

      {/* Appointments Table */}
      <AppointmentTable
        items={filteredAppointments}
        vets={vets || []}
        loading={isFetching}
        showActions={false}
        onAppointmentClick={(item) => {
          setSelectedAppointment(item);
          setModalOpen(true);
        }}
      />

      {/* Edit Modal */}
      {toEditableAppointment(selectedAppointment) && (
        <AppointmentModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedAppointment(null);
          }}
          tenantId={tenantId || ''}
          editData={(() => {
            const editable = toEditableAppointment(selectedAppointment);
            if (!editable) return undefined;
            return {
              id: editable.id,
              title: editable.title,
              description: editable.description || null,
              startTime: new Date(editable.startTime),
              endTime: new Date(editable.endTime),
              status: editable.status,
              patientId: editable.patientId,
              vetId: editable.vetId,
              patientName: editable.patientName,
            };
          })()}
          onSuccess={() => {
            refetchAppointments();
            setModalOpen(false);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
}
  type EditableSource = AppointmentType & {
    title: string;
    patientId: string;
    description?: string | null;
    patientName?: string | null;
  };
