"use client";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(1);

  const handleComplete = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Willkommen, {user?.firstName || "Nutzer"}! 👋
          </h1>
          <p className="text-lg text-gray-600">
            Lassen Sie uns Ihre Praxis einrichten.
          </p>
        </div>

        <div className="space-y-6">
          {/* Schritt 1: Praxisinfo */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Praxisinformationen
                </h2>
                <p className="text-gray-600 mb-4">
                  Geben Sie die Grundinformationen Ihrer Tierarztpraxis ein.
                </p>
                {step >= 1 && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Praxisname"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Adresse"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      type="email"
                      placeholder="E-Mail"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Schritt 2: Datenmigration */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Daten importieren (Optional)
                </h2>
                <p className="text-gray-600">
                  Importieren Sie Ihre bestehenden Patienten und Termine aus
                  Vetera, easyVET oder Vetinf.
                </p>
              </div>
            </div>
          </Card>

          {/* Schritt 3: Team einladen */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Team einladen
                </h2>
                <p className="text-gray-600">
                  Laden Sie Ihre Mitarbeiter ein, um gemeinsam zu arbeiten.
                </p>
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <Button
              onClick={handleComplete}
              className="flex-1 text-lg px-6 py-3"
            >
              Zum Dashboard
            </Button>
            <Button variant="outline" className="flex-1 text-lg px-6 py-3">
              Später einrichten
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
