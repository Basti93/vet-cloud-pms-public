import { ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { BarChart, Calendar, Users, Phone } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-900 text-white p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-8">Vet Cloud</h1>
        
        <nav className="space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-800 transition">
            <BarChart size={20} />
            <span>Übersicht</span>
          </Link>
          <Link href="/dashboard/schedule" className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-800 transition">
            <Calendar size={20} />
            <span>Terminkalender</span>
          </Link>
          <Link href="/dashboard/patients" className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-800 transition">
            <Users size={20} />
            <span>Patienten</span>
          </Link>
          <Link href="/dashboard/voice" className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-800 transition">
            <Phone size={20} />
            <span>AI-Rezeption</span>
          </Link>
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
