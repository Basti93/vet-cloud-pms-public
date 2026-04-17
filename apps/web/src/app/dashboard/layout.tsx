import { ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { LayoutDashboard, Calendar, Users, Phone, ClipboardList } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Übersicht" },
  { href: "/dashboard/schedule", icon: Calendar, label: "Terminkalender" },
  { href: "/dashboard/patients", icon: Users, label: "Patienten" },
  { href: "/dashboard/bookings", icon: ClipboardList, label: "Buchungsanfragen" },
  { href: "/dashboard/voice", icon: Phone, label: "AI-Rezeption" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-sm font-bold">VC</div>
            <div>
              <p className="font-bold text-sm leading-tight">Vet Cloud</p>
              <p className="text-xs text-gray-400 leading-tight">Praxisverwaltung</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors group"
            >
              <Icon size={18} className="text-gray-400 group-hover:text-white transition-colors" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
            <p className="text-xs text-gray-400">Angemeldet</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-end flex-shrink-0">
          <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">Demo-Praxis</span>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
