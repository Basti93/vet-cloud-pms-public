'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@clerk/nextjs';
import { AlertCircle, CheckCircle2, XCircle, Calendar, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TableFilters, type FilterState } from '@/components/appointments/TableFilters';
import { AppointmentTable } from '@/components/appointments/AppointmentTable';

export default function BookingsPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    vetId: null,
    status: null,
    dateFrom: '',
    dateTo: '',
    searchQuery: '',
  });

  // Get tenant ID - use demo tenant as fallback for now
  useEffect(() => {
    const demoTenantId = '00000000-0000-4000-8000-000000000003';
    setTenantId(demoTenantId);
  }, [userId]);

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
      if (filters.vetId && b.patient && true) {
        // Could add vet filtering here if needed
      }

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

  const pendingBookings = filteredBookings.filter((b) => b.status === 'scheduled');
  const confirmedBookings = filteredBookings.filter((b) => b.status === 'completed');
  const rejectedBookings = filteredBookings.filter((b) => b.status === 'cancelled');
  const allBookingsCount = filteredBookings.length;


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Buchungsanfragen</h1>
          <p className="text-gray-600 mb-3">Online-Buchungen von Kunden, die Sie bestätigen oder ablehnen müssen</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gesamt</p>
                <p className="text-2xl font-bold text-gray-900">{allBookingsCount}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ausstehend</p>
                <p className="text-2xl font-bold text-gray-900">{pendingBookings.length}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Bestätigt</p>
                <p className="text-2xl font-bold text-gray-900">{confirmedBookings.length}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Abgelehnt</p>
                <p className="text-2xl font-bold text-gray-900">{rejectedBookings.length}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>

        {/* Filter Component */}
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
              searchQuery: '',
            })
          }
          showSearch={true}
          statusOptions={[
            { value: 'scheduled', label: 'Ausstehend' },
            { value: 'completed', label: 'Bestätigt' },
            { value: 'confirmed', label: 'Bestätigt' },
            { value: 'cancelled', label: 'Abgelehnt' },
          ]}
        />

        {/* Bookings List by Vet using shared component */}
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
    </div>
  );
}
