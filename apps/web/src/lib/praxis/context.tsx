'use client';

import React, { createContext, useContext } from 'react';
import type { PraxisPreferences } from '@/lib/user/preferences';

interface PraxisContextType {
  praxis: PraxisPreferences | null;
  isLoading: boolean;
}

const PraxisContext = createContext<PraxisContextType | undefined>(undefined);

interface PraxisProviderProps {
  children: React.ReactNode;
  praxis: PraxisPreferences | null;
  isLoading?: boolean;
}

/**
 * PraxisProvider - Provides tenant/clinic-wide settings (Praxis data).
 * Initialized from server-side data in layout.tsx, so it's always available.
 */
export function PraxisProvider({ children, praxis, isLoading = false }: PraxisProviderProps) {
  return (
    <PraxisContext.Provider value={{ praxis, isLoading }}>
      {children}
    </PraxisContext.Provider>
  );
}

/**
 * usePraxis - Access tenant/clinic data (tenantId, tenantName, etc.)
 * Always returns data because it's loaded server-side.
 *
 * Usage:
 *   const { praxis } = usePraxis();
 *   console.log(praxis?.tenantName); // "My Veterinary Clinic"
 */
export function usePraxis() {
  const context = useContext(PraxisContext);
  if (!context) {
    throw new Error('usePraxis must be used within PraxisProvider');
  }
  return context;
}
