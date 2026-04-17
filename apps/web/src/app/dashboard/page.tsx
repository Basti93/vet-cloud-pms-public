import { Card } from "@/components/ui/card";

export default function DashboardHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Willkommen zurück\!</h1>
        <p className="text-gray-600 mt-2">Übersicht Ihrer Praxis</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <p className="text-sm text-gray-600">Termine heute</p>
          <p className="text-3xl font-bold text-gray-900">12</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600">Patienten</p>
          <p className="text-3xl font-bold text-gray-900">284</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600">Mitglieder Team</p>
          <p className="text-3xl font-bold text-gray-900">3</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-600">AI-Anrufe (Monat)</p>
          <p className="text-3xl font-bold text-gray-900">156</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Schnellaktionen</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition text-left">
            <p className="font-semibold text-blue-900">Neuer Termin</p>
            <p className="text-sm text-blue-700">Patient / Termin hinzufügen</p>
          </button>
          <button className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition text-left">
            <p className="font-semibold text-green-900">Neuer Patient</p>
            <p className="text-sm text-green-700">Neue Tierkarte erstellen</p>
          </button>
          <button className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition text-left">
            <p className="font-semibold text-purple-900">Migration starten</p>
            <p className="text-sm text-purple-700">Aus Alt-System importieren</p>
          </button>
        </div>
      </Card>
    </div>
  );
}
