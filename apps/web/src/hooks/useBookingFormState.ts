import { useEffect, useState } from "react";

interface BookingFormState {
  vetId?: string;
  date?: string;
  patient?: {
    name: string;
    species: string;
    breed: string;
    reason: string;
  };
  owner?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

const STORAGE_KEY = "booking_form_state";
const TTL_KEY = "booking_form_state_ttl";
const TTL_HOURS = 24;

export function useBookingFormState(tenantSlug: string) {
  const [state, setState] = useState<BookingFormState>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const ttl = localStorage.getItem(TTL_KEY);
    const now = Date.now();

    if (stored && ttl) {
      const expiresAt = parseInt(ttl);
      if (expiresAt > now) {
        try {
          setState(JSON.parse(stored));
        } catch {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(TTL_KEY);
        }
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TTL_KEY);
      }
    }

    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (!isLoaded) return;

    if (Object.keys(state).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TTL_KEY);
    } else {
      const expiresAt = Date.now() + TTL_HOURS * 60 * 60 * 1000;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(TTL_KEY, expiresAt.toString());
    }
  }, [state, isLoaded]);

  const updateField = (key: keyof BookingFormState, value: unknown) => {
    setState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clear = () => {
    setState({});
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TTL_KEY);
  };

  return { state, updateField, clear, isLoaded };
}
