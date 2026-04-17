"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import Link from "next/link";

const MOCK_PATIENTS = [
  { id: "1", name: "Max", species: "Hund", breed: "Labrador", ownerName: "Peter Müller", age: 5 },
  { id: "2", name: "Bella", species: "Katze", breed: "Britisch Kurzhaar", ownerName: "Anna Schmidt", age: 3 },
  { id: "3", name: "Rex", species: "Hund", breed: "Schäferhund", ownerName: "Thomas Johnson", age: 7 },
];

export default function PatientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const filteredPatients = MOCK_PATIENTS.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.ownerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Patienten</h1>
          <p className="text-gray-600 mt-2">Verwalten Sie Ihre Tierpatienten</p>
        </div>
        <Button size="lg">Neuer Patient</Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Nach Patient oder Halter suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Name</th>
                <th className="px-6 py-3 text-left font-semibold">Art/Rasse</th>
                <th className="px-6 py-3 text-left font-semibold">Halter</th>
                <th className="px-6 py-3 text-left font-semibold">Alter</th>
                <th className="px-6 py-3 text-left font-semibold">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((patient) => (
                <tr key={patient.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold">{patient.name}</td>
                  <td className="px-6 py-4">{patient.species} / {patient.breed}</td>
                  <td className="px-6 py-4">{patient.ownerName}</td>
                  <td className="px-6 py-4">{patient.age} Jahre</td>
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/patients/${patient.id}`}>
                      <Button variant="outline" size="sm">Details</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
