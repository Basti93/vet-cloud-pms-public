'use client';

import { Filter } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

export interface AppointmentFiltersState {
  vetId: string | null;
  status: string | null;
  dateFrom: string;
  dateTo: string;
}

interface AppointmentFiltersProps {
  tenantId: string | null;
  userId: string | null;
  filters: AppointmentFiltersState;
  onChange: (filters: AppointmentFiltersState) => void;
  onReset: () => void;
}

export function AppointmentFilters({
  tenantId,
  userId,
  filters,
  onChange,
  onReset,
}: AppointmentFiltersProps) {
  // Fetch vets
  const { data: vets } = trpc.vet.list.useQuery(
    { tenantId: tenantId || '' },
    { enabled: !!tenantId && !!userId }
  );

  const handleVetChange = (vetId: string) => {
    onChange({ ...filters, vetId: vetId || null });
  };

  const handleStatusChange = (status: string) => {
    onChange({ ...filters, status: status || null });
  };

  const handleDateFromChange = (date: string) => {
    onChange({ ...filters, dateFrom: date });
  };

  const handleDateToChange = (date: string) => {
    onChange({ ...filters, dateTo: date });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Vet Filter */}
        {vets && vets.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Arzt
            </label>
            <select
              value={filters.vetId || ''}
              onChange={(e) => handleVetChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Alle Ärzte</option>
              {vets.map((vet) => (
                <option key={vet.id} value={vet.id}>
                  Dr. {vet.firstName} {vet.lastName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Alle Status</option>
            <option value="scheduled">Geplant</option>
            <option value="completed">Abgeschlossen</option>
            <option value="cancelled">Abgelehnt</option>
            <option value="no-show">Nicht erschienen</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Von
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bis
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Reset Button */}
        <div className="flex items-end">
          <button
            onClick={onReset}
            className="w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:border-gray-400 font-medium flex items-center justify-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Zurücksetzen
          </button>
        </div>
      </div>
    </div>
  );
}
