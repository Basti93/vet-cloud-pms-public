'use client';

import { useState } from 'react';
import { ChevronDown, Calendar, Loader2 } from 'lucide-react';
import { SpeciesIcon } from '@/components/ui/badge';

// Union type to support both Appointments and Bookings
type AppointmentType =
  | {
      id: string;
      startTime: Date | string;
      endTime: Date | string;
      title: string;
      status: string;
      vetId: string;
      patientName?: string;
      patientSpecies?: string;
      ownerFirstName?: string;
      ownerLastName?: string;
    }
  | {
      id: string;
      startTime: Date | string;
      endTime: Date | string;
      vetId: string;
      status: 'scheduled' | 'completed' | 'cancelled' | 'confirmed';
      patient: {
        name: string;
        species: string;
      };
      owner: {
        firstName: string;
        lastName: string;
        email: string;
      };
      reason?: string;
    };

interface Vet {
  id: string;
  firstName: string;
  lastName: string;
}

interface AppointmentTableProps {
  items: AppointmentType[];
  vets: Vet[];
  loading?: boolean;
  compact?: boolean;
  onConfirm?: (itemId: string) => void;
  onReject?: (itemId: string) => void;
  confirmingId?: string | null;
  rejectingId?: string | null;
  todayStart?: Date;
  todayEnd?: Date;
  showActions?: boolean;
}

function isBooking(item: AppointmentType): item is AppointmentType & {
  patient: { name: string; species: string };
  owner: { firstName: string; lastName: string; email: string };
} {
  return 'patient' in item && typeof item.patient === 'object' && 'owner' in item;
}

function getPatientName(item: AppointmentType): string {
  if (isBooking(item)) {
    return item.patient.name;
  }
  return (item as any).patientName ?? '—';
}

function getPatientSpecies(item: AppointmentType): string {
  if (isBooking(item)) {
    return item.patient.species;
  }
  return (item as any).patientSpecies ?? 'other';
}

function getOwnerName(item: AppointmentType): string {
  if (isBooking(item)) {
    return `${item.owner.firstName} ${item.owner.lastName}`;
  }
  const appt = item as any;
  return appt.ownerFirstName ? `${appt.ownerFirstName} ${appt.ownerLastName}` : '';
}

function getTitle(item: AppointmentType): string {
  if (isBooking(item)) {
    return (item as any).reason || '—';
  }
  return (item as any).title || '—';
}

function getStatusColor(status: string) {
  switch (status) {
    case 'scheduled':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'completed':
    case 'confirmed':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'cancelled':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'Ausstehend';
    case 'completed':
    case 'confirmed':
      return 'Bestätigt';
    case 'cancelled':
      return 'Abgelehnt';
    case 'no-show':
      return 'Nicht erschienen';
    default:
      return status;
  }
}

export function AppointmentTable({
  items,
  vets,
  loading = false,
  compact = false,
  onConfirm,
  onReject,
  confirmingId,
  rejectingId,
  todayStart,
  todayEnd,
  showActions = false,
}: AppointmentTableProps) {
  const [expandedVets, setExpandedVets] = useState<Set<string>>(
    new Set(vets.map((v) => v.id))
  );

  const toggleVetExpanded = (vetId: string) => {
    const newSet = new Set(expandedVets);
    if (newSet.has(vetId)) {
      newSet.delete(vetId);
    } else {
      newSet.add(vetId);
    }
    setExpandedVets(newSet);
  };

  const formatDateTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatFullDateTime = (date: Date | string) => {
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

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <Calendar size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">Keine Termine</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vets.map((vet) => {
        const vetItems = items.filter((item) => item.vetId === vet.id);

        if (vetItems.length === 0) return null;

        const pending = vetItems.filter((i) => i.status === 'scheduled').length;
        const confirmed = vetItems.filter(
          (i) => i.status === 'completed' || i.status === 'confirmed'
        ).length;
        const rejected = vetItems.filter((i) => i.status === 'cancelled').length;

        const isExpanded = expandedVets.has(vet.id);
        const displayItems = compact ? vetItems.slice(0, 2) : vetItems;
        const hasMore = compact && vetItems.length > 2;

        return (
          <div key={vet.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <button
              onClick={() => toggleVetExpanded(vet.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-200"
            >
              <div className="flex items-center gap-3">
                <ChevronDown
                  className={`w-5 h-5 text-gray-600 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    Dr. {vet.firstName} {vet.lastName}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    📋 {pending} ausstehend • ✅ {confirmed} bestätigt • ❌ {rejected} abgelehnt
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold text-gray-900 ${compact ? 'text-lg' : 'text-xl'}`}>
                  {vetItems.length}
                </p>
                <p className="text-xs text-gray-500">Termine</p>
              </div>
            </button>

            {/* Content */}
            {isExpanded && (
              <div className="divide-y divide-gray-100">
                {showActions ? (
                  // Table view with action buttons (for Bookings)
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">
                            Zeitslot
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">
                            Patient
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">
                            Besitzer
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">
                            Grund
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-gray-900">
                            Aktionen
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {displayItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {formatFullDateTime(item.startTime)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(item.endTime).toLocaleTimeString('de-DE', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-semibold text-indigo-600">
                                    <SpeciesIcon species={getPatientSpecies(item)} />
                                  </span>
                                </div>
                                <p className="font-medium text-gray-900">{getPatientName(item)}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">{getOwnerName(item)}</p>
                                {isBooking(item) && (
                                  <p className="text-xs text-gray-500">{item.owner.email}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {getTitle(item)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(item.status)}`}>
                                {getStatusLabel(item.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {item.status === 'scheduled' ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => onConfirm?.(item.id)}
                                    disabled={confirmingId === item.id || rejectingId !== null}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                                  >
                                    {confirmingId === item.id && (
                                      <Loader2 size={12} className="animate-spin" />
                                    )}
                                    Bestätigen
                                  </button>
                                  <button
                                    onClick={() => onReject?.(item.id)}
                                    disabled={rejectingId === item.id || confirmingId !== null}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                                  >
                                    {rejectingId === item.id && (
                                      <Loader2 size={12} className="animate-spin" />
                                    )}
                                    Ablehnen
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">Keine Aktion</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // List view (for Dashboard compact mode)
                  <div className="divide-y divide-gray-100">
                    {displayItems.map((item) => {
                      const d = new Date(item.startTime);
                      const isToday = todayStart && todayEnd && d >= todayStart && d < todayEnd;

                      return (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                            compact ? 'text-xs' : 'text-sm'
                          }`}
                        >
                          <div
                            className={`rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isToday ? 'bg-blue-100' : 'bg-gray-100'
                            } ${compact ? 'w-7 h-7' : 'w-9 h-9'}`}
                          >
                            <span className={compact ? 'text-sm' : 'text-lg'}>
                              <SpeciesIcon species={getPatientSpecies(item)} />
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-gray-900 truncate">
                                {getPatientName(item)} — {getTitle(item)}
                              </p>
                            </div>
                            <p className="text-gray-500 mt-0.5 flex items-center gap-1">
                              {isToday ? 'Heute, ' : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }) + ', '}
                              {formatDateTime(item.startTime)} Uhr
                              {getOwnerName(item) && (
                                <span className="ml-1 text-gray-300">·</span>
                              )}
                              {getOwnerName(item) && (
                                <span className="ml-1 text-gray-500">
                                  {getOwnerName(item)}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {hasMore && (
                  <div className="text-center py-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
                    {vetItems.length - 2} weitere Termine
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
