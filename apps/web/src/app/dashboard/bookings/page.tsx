'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@clerk/nextjs';
import { AlertCircle, CheckCircle2, XCircle, Calendar } from 'lucide-react';
import { useTenant } from '@/hooks/useTenant';
import { useCurrentVet } from '@/hooks/useCurrentVet';
import { TableFilters, type FilterState } from '@/components/appointments/TableFilters';
import { AppointmentTable } from '@/components/appointments/AppointmentTable';

export default function BookingsPage() {
  const { userId } = useAuth();
  const { tenantId } = useTenant();
  const vetId = useCurrentVet();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    vetId: null,
    status: null,
    dateFrom: '',
    dateTo: '',
    searchQuery: '',
  });

  // Auto-set filter to current vet only for real vet users.
  useEffect(() => {
    if (!vetId) return;
    setFilters((prev) => (prev.vetId ? prev : { ...prev, vetId }));
  }, [vetId]);

  // Fetch bookings
  const { data: bookings, isLoading: isFetching, refetch } = trpc.booking.list.useQuery(
    { tenantId: tenantId || '' },
    { enabled: !!tenantId && !!userId }
  );

  // Fetch all vets
  const { data: vets } = trpc.vet.list.useQuery(
    { tenantId: tenantId || '' },
    { enabled: !!tenantId && !!userId }
  );

  const confirmMutation = trpc.booking.confirm.useMutation({
    onSuccess: () => {
      void refetch();
      setConfirmingId(null);
    },
    onError: (error) => {
      console.error('❌ Confirm failed:', error);
      setConfirmingId(null);
    },
  });

  const rejectMutation = trpc.booking.reject.useMutation({
    onSuccess: () => {
      void refetch();
      setRejectingId(null);
    },
    onError: (error) => {
      console.error('❌ Reject failed:', error);
      setRejectingId(null);
    },
  });

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

  const handleConfirm = async (appointmentId: string) => {
    setConfirmingId(appointmentId);
    await confirmMutation.mutateAsync({ appointmentId, tenantId });
  };

  const handleReject = async (appointmentId: string) => {
    setRejectingId(appointmentId);
    await rejectMutation.mutateAsync({ appointmentId, tenantId });
  };

  // Apply all filters and sort by date (ascending - upcoming first)
  const filteredBookings = (bookings || [])
    .filter((b) => {
      // Status filter
      if (filters.status && b.status !== filters.status) return false;

      // Vet filter
      if (filters.vetId && b.vetId !== filters.vetId) return false;

      // Search filter (patient name or owner name)
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const patientMatch = b.patient?.name.toLowerCase().includes(query);
        const ownerMatch = `${b.owner.firstName} ${b.owner.lastName}`
          .toLowerCase()
          .includes(query);
        const emailMatch = b.owner.email?.toLowerCase().includes(query);
        if (!patientMatch && !ownerMatch && !emailMatch) return false;
      }

      // Date range filter
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (new Date(b.startTime) < fromDate) return false;
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(b.startTime) > toDate) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by date ascending (upcoming appointments first)
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

  const pendingBookings = filteredBookings.filter((b) => b.status === 'scheduled' || b.status === 'pending-confirmation');
  const confirmedBookings = filteredBookings.filter((b) => b.status === 'confirmed');
  const rejectedBookings = filteredBookings.filter((b) => b.status === 'cancelled');
  const allBookingsCount = filteredBookings.length;


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-fg">Buchungsanfragen</h1>
        <p className="text-muted mt-1">Online-Buchungen von Kunden, die Sie bestätigen oder ablehnen müssen</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Gesamt", value: allBookingsCount, icon: <Calendar size={20} />, color: "var(--color-accent)" },
          { label: "Ausstehend", value: pendingBookings.length, icon: <AlertCircle size={20} />, color: "#d97706" },
          { label: "Bestätigt", value: confirmedBookings.length, icon: <CheckCircle2 size={20} />, color: "#16a34a" },
          { label: "Abgelehnt", value: rejectedBookings.length, icon: <XCircle size={20} />, color: "#dc2626" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-surface rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted">{label}</p>
              <span style={{ color }}>{icon}</span>
            </div>
            <p className="text-2xl font-bold text-fg">{value}</p>
          </div>
        ))}
      </div>

      <TableFilters
        tenantId={tenantId}
        userId={userId}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters({ vetId: null, status: null, dateFrom: '', dateTo: '', searchQuery: '' })}
        showSearch={true}
        statusOptions={[
          { value: 'pending-confirmation', label: 'Nicht verifiziert' },
          { value: 'scheduled', label: 'Ausstehend' },
          { value: 'confirmed', label: 'Bestätigt' },
          { value: 'cancelled', label: 'Abgelehnt' },
        ]}
      />

      <AppointmentTable
        items={filteredBookings}
        vets={vets || []}
        loading={isFetching}
        onConfirm={handleConfirm}
        onReject={handleReject}
        confirmingId={confirmingId}
        rejectingId={rejectingId}
        showActions={true}
      />
    </div>
  );
}
