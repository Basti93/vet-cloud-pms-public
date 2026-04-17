"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const MOCK_PATIENT = {
  id: "1",
  name: "Max",
  species: "Hund",
  breed: "Labrador",
  birthDate: "2019-03-15",
  owner: {
    name: "Peter Müller",
    email: "peter@example.com",
    phone: "030-12345678",
  },
  medicalHistory: [
    { date: "2026-03-15", service: "Impfung Tollwut", notes: "Routine-Impfung" },
    { date: "2026-01-20", service: "Zahnreinigung", notes: "Professionelle Zahnreinigung" },
  ],
};

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/patients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2" size={16} />
            Zurück
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{MOCK_PATIENT.name}</h1>
          <p className="text-gray-600">{MOCK_PATIENT.species} • {MOCK_PATIENT.breed}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Patienten-Informationen</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Geburtsdatum</p>
                <p className="font-semibold">{MOCK_PATIENT.birthDate}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Medizinische Vorgeschichte</h2>
            <div className="space-y-4">
              {MOCK_PATIENT.medicalHistory.map((entry, idx) => (
                <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex justify-between">
                    <p className="font-semibold">{entry.service}</p>
                    <p className="text-sm text-gray-600">{entry.date}</p>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{entry.notes}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Halter-Informationen</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-semibold">{MOCK_PATIENT.owner.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Telefon</p>
                <p className="font-semibold">{MOCK_PATIENT.owner.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">E-Mail</p>
                <p className="font-semibold">{MOCK_PATIENT.owner.email}</p>
              </div>
            </div>
            <Button className="w-full mt-6">Neuer Termin</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
