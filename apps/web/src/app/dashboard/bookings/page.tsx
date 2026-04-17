'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useAuth } from '@clerk/nextjs';
import { AlertCircle, CheckCircle2, XCircle, Calendar, User, Clock, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BookingsPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [selectedVetId, setSelectedVetId] = useState<string | null>(null);

  // Get tenant ID - use demo tenant as fallback for now
  useEffect(() => {
    // For demo purposes: use demo tenant ID
    // In production: fetch from user profile or auth token
    const demoTenantId = "00000000-0000-4000-8000-000000000003";
    setTenantId(demoTenantId);
  }, [userId]);

  // Fetch all vets
  const { data: vets } = trpc.vet.list.useQuery(
    { tenantId: tenantId || '' },
    { enabled: !!tenantId && !!userId }
  );

  // Fetch bookings
  const { data: bookings, isLoading: isFetching, refetch } = trpc.booking.list.useQuery(
    { tenantId: tenantId || '' },
    { enabled: !!tenantId && !!userId }
  );

  const confirmMutation = trpc.booking.confirm.useMutation({
    onSuccess: () => {
      void refetch();
      setConfirmingId(null);
    },
    onError: (error) => {
      console.error("❌ Confirm failed:", error);
      setConfirmingId(null);
    },
  });

  const rejectMutation = trpc.booking.reject.useMutation({
    onSuccess: () => {
      void refetch();
      setRejectingId(null);
    },
    onError: (error) => {
      console.error("❌ Reject failed:", error);
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

  // Filter bookings by status and vet
  const filteredBookings = selectedVetId
    ? bookings?.filter(b => b.patient && true) // Will filter by vet in next step
    : bookings || [];

  const pendingBookings = filteredBookings?.filter(b => b.status === 'scheduled') || [];
  const confirmedBookings = filteredBookings?.filter(b => b.status === 'completed') || [];
  const rejectedBookings = filteredBookings?.filter(b => b.status === 'cancelled') || [];

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header with Vet Selector */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Buchungsanfragen</h1>
              <p className="text-gray-600">Verwalten Sie Ihre Online-Buchungen</p>
            </div>
            {vets && vets.length > 0 && (
              <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-gray-600" />
                <select
                  value={selectedVetId || ''}
                  onChange={(e) => setSelectedVetId(e.target.value || null)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Alle Ärzte</option>
                  {vets.map((vet) => (
                    <option key={vet.id} value={vet.id}>
                      Dr. {vet.firstName} {vet.lastName} ({vet.appointmentCount})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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

        {/* Bookings List */}
        <div className="bg-white rounded-lg shadow">
          {isFetching ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-gray-600">Laden...</p>
            </div>
          ) : bookings && bookings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Zeitslot</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Patient</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Besitzer</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Grund</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {formatDateTime(booking.startTime)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(booking.endTime).toLocaleTimeString('de-DE', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-xs font-semibold text-indigo-600">
                              {booking.patient.species.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{booking.patient.name}</p>
                            <p className="text-xs text-gray-500">
                              {booking.patient.breed || booking.patient.species}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {booking.owner.firstName} {booking.owner.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{booking.owner.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">{booking.title}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                            booking.status === 'scheduled'
                              ? 'bg-yellow-100 text-yellow-800'
                              : booking.status === 'cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {booking.status === 'scheduled' && (
                            <>
                              <AlertCircle className="w-3 h-3" />
                              Ausstehend
                            </>
                          )}
                          {booking.status === 'cancelled' && (
                            <>
                              <XCircle className="w-3 h-3" />
                              Abgelehnt
                            </>
                          )}
                          {booking.status === 'completed' && (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Abgeschlossen
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {booking.status === 'scheduled' && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleConfirm(booking.id)}
                              disabled={confirmingId === booking.id || confirmMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {confirmingId === booking.id ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-green-700" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              Bestätigen
                            </button>
                            <button
                              onClick={() => handleReject(booking.id)}
                              disabled={rejectingId === booking.id || rejectMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {rejectingId === booking.id ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-red-700" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                              Ablehnen
                            </button>
                          </div>
                        )}
                        {booking.status === 'cancelled' && (
                          <span className="text-xs text-gray-500">Keine Aktionen</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Keine Buchungsanfragen</p>
              <p className="text-gray-500 text-sm mt-1">
                Es wurden noch keine Online-Buchungen vorgenommen.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
