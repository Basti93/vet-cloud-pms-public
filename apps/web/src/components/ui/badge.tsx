interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
  children: React.ReactNode;
  className?: string;
}

const variants = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
  purple: "bg-purple-100 text-purple-800",
};

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// Appointment status → variant mapping
export function AppointmentStatusBadge({
  status,
}: {
  status: "scheduled" | "completed" | "cancelled" | "confirmed" | "no-show" | string;
}) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    scheduled: { variant: "info", label: "Geplant" },
    completed: { variant: "success", label: "Bestätigt" },
    confirmed: { variant: "success", label: "Bestätigt" },
    cancelled: { variant: "danger", label: "Abgesagt" },
    "no-show": { variant: "warning", label: "Nicht erschienen" },
  };

  const config = map[status] ?? { variant: "default", label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Species → emoji
export function SpeciesIcon({ species }: { species: string }) {
  const icons: Record<string, string> = {
    Hund: "🐕",
    Katze: "🐈",
    Vogel: "🐦",
    Kaninchen: "🐇",
    Hamster: "🐹",
    Meerschweinchen: "🐾",
    Reptil: "🦎",
    Fisch: "🐠",
  };
  return <span>{icons[species] ?? "🐾"}</span>;
}
