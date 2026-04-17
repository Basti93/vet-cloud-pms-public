import type { ReactNode } from "react";

/** Minimal layout for the public booking widget — no sidebar, no auth. */
export default function BookLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
