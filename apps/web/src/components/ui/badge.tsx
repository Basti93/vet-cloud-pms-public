import { Dog, Cat, Bird, Rabbit, Squirrel, PawPrint, Zap, Fish } from "lucide-react";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
  children: React.ReactNode;
  className?: string;
}

const variants = {
  default: "bg-muted-soft text-muted",
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
  status: "scheduled" | "completed" | "cancelled" | "confirmed" | "no-show" | "pending-confirmation" | string;
}) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    scheduled: { variant: "info", label: "Geplant" },
    completed: { variant: "success", label: "Abgeschlossen" },
    confirmed: { variant: "success", label: "Bestätigt" },
    cancelled: { variant: "danger", label: "Abgesagt" },
    "no-show": { variant: "warning", label: "Nicht erschienen" },
    "pending-confirmation": { variant: "warning", label: "Nicht verifiziert" },
  };

  const config = map[status] ?? { variant: "default", label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// Species → icon mapping
export function SpeciesIcon({ species }: { species: string }) {
  const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    Hund: Dog,
    Katze: Cat,
    Vogel: Bird,
    Kaninchen: Rabbit,
    Hamster: Squirrel,
    Meerschweinchen: PawPrint,
    Reptil: Zap,
    Fisch: Fish,
  };

  const IconComponent = iconMap[species] ?? PawPrint;
  return <IconComponent size={16} className="inline" />;
}
