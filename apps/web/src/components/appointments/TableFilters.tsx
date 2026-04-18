'use client';

import { useState } from 'react';
import { Filter, ChevronDown, X, Search } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

export type FilterState = {
  vetId: string | null;
  status: string | null;
  dateFrom: string;
  dateTo: string;
  searchQuery?: string;
};

interface TableFiltersProps {
  tenantId: string | null;
  userId: string | null;
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  showSearch?: boolean;
  statusOptions?: Array<{ value: string; label: string }>;
}

const defaultStatusOptions = [
  { value: 'scheduled', label: 'Geplant' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'confirmed', label: 'Bestätigt' },
  { value: 'cancelled', label: 'Abgelehnt' },
  { value: 'no-show', label: 'Nicht erschienen' },
];

export function TableFilters({
  tenantId,
  userId,
  filters,
  onChange,
  onReset,
  showSearch = false,
  statusOptions = defaultStatusOptions,
}: TableFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch vets
  const { data: vets } = trpc.vet.list.useQuery(
    { tenantId: tenantId || '' },
    { enabled: !!tenantId && !!userId }
  );

  const hasActiveFilters =
    filters.vetId ||
    filters.status ||
    filters.dateFrom ||
    filters.dateTo ||
    (filters.searchQuery && filters.searchQuery.length > 0);

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

  const handleSearchChange = (query: string) => {
    onChange({ ...filters, searchQuery: query });
  };

  return (
    <div className="mb-6 md:mb-8">
      {/* Filter Header (Expandable) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-3 md:p-4 rounded-lg border-2 transition-all ${
          isExpanded
            ? 'bg-indigo-50 border-indigo-300'
            : 'bg-white border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Filter className="w-5 h-5 text-indigo-600 flex-shrink-0" />
          <div className="text-left min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm md:text-base">Filter</h3>
            {hasActiveFilters && (
              <p className="text-xs text-indigo-600 truncate">
                {[
                  filters.searchQuery && `Suche: "${filters.searchQuery}"`,
                  filters.vetId && 'Arzt gefiltert',
                  filters.status && 'Status gefiltert',
                  (filters.dateFrom || filters.dateTo) && 'Datum gefiltert',
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 flex-shrink-0"
              title="Filter zurücksetzen"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown
            className={`w-5 h-5 text-gray-600 transition-transform flex-shrink-0 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Filter Content (Expandable) */}
      {isExpanded && (
        <div className="bg-white border border-t-0 border-gray-200 rounded-b-lg shadow-sm p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Search */}
          {showSearch && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suche
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Name oder Email..."
                  value={filters.searchQuery || ''}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Filter Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Vet Filter */}
            {vets && vets.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arzt
                </label>
                <select
                  value={filters.vetId || ''}
                  onChange={(e) => handleVetChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Alle Status</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
