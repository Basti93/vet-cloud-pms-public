"use client";
import { Card } from "@/components/ui/card";

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Terminkalender</h1>
        <p className="text-gray-600 mt-2">Verwalten Sie Ihre Tierarzt-Termine</p>
      </div>

      <Card className="p-6 h-96 bg-white border-2 border-dashed border-gray-300 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg">FullCalendar wird nach npm install angezeigt</p>
          <p className="text-sm mt-2">Installieren Sie die Dependencies lokal</p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Nächste Termine (Demo)</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
            <div>
              <p className="font-semibold">Max Müller - Impfung</p>
              <p className="text-sm text-gray-500">2026-04-17 10:00</p>
            </div>
            <button className="px-3 py-1 bg-blue-500 text-white rounded">Details</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
