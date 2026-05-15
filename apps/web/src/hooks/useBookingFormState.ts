import { useEffect, useState } from "react";

interface BookingFormState {
  browserSessionId?: string;
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
const SESSION_ID_KEY = "booking_browser_session_id";
const TTL_HOURS = 24;

function generateOrGetSessionId(): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;

  // Generate new session ID (UUID v4)
  const sessionId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  localStorage.setItem(SESSION_ID_KEY, sessionId);
  return sessionId;
}

export function useBookingFormState(_tenantSlug: string) {
  const [state, setState] = useState<BookingFormState>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const sessionId = generateOrGetSessionId();
    const stored = localStorage.getItem(STORAGE_KEY);
    const ttl = localStorage.getItem(TTL_KEY);
    const now = Date.now();

    let loadedState: BookingFormState = { browserSessionId: sessionId };

    if (stored && ttl) {
      const expiresAt = parseInt(ttl);
      if (expiresAt > now) {
        try {
          const parsed = JSON.parse(stored);
          loadedState = { ...parsed, browserSessionId: sessionId };
        } catch {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(TTL_KEY);
        }
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TTL_KEY);
      }
    }

    setState(loadedState);
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
    const sessionId = generateOrGetSessionId();
    setState({ browserSessionId: sessionId });
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TTL_KEY);
  };

  return { state, updateField, clear, isLoaded };
}
