"use client";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { CheckCircle, Mail, Building2, Users } from "lucide-react";

interface FormData {
  practiceName: string;
  address: string;
  email: string;
  phone: string;
  teamEmails: string[];
}

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    practiceName: "",
    address: "",
    email: "",
    phone: "",
    teamEmails: [""],
  });

  const handleInputChange = (field: keyof Omit<FormData, "teamEmails">, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTeamEmailChange = (index: number, value: string) => {
    const newEmails = [...formData.teamEmails];
    newEmails[index] = value;
    setFormData(prev => ({ ...prev, teamEmails: newEmails }));
  };

  const addTeamEmail = () => {
    setFormData(prev => ({ ...prev, teamEmails: [...prev.teamEmails, ""] }));
  };

  const removeTeamEmail = (index: number) => {
    setFormData(prev => ({
      ...prev,
      teamEmails: prev.teamEmails.filter((_, i) => i !== index),
    }));
  };

  const handleComplete = async () => {
    // TODO: Submit formData to API
    // For now, just show success message
    setStep(3);
  };

  const handleSkip = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}>
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">
            Willkommen, {user?.firstName || "Nutzer"}!
          </h1>
          <p className="text-xl" style={{ color: 'var(--color-muted)' }}>
            Lassen Sie uns Ihre Tierarztpraxis einrichten.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-12">
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold transition ${
              step >= 1
                ? 'text-white'
                : 'text-fg'
            }`} style={{
              backgroundColor: step >= 1 ? 'var(--color-accent)' : 'var(--color-border)',
            }}>
              {step > 1 ? <CheckCircle className="w-6 h-6" /> : '1'}
            </div>
            <div className="flex-1 h-1" style={{ backgroundColor: step > 1 ? 'var(--color-accent)' : 'var(--color-border)' }} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold transition ${
              step >= 2
                ? 'text-white'
                : 'text-fg'
            }`} style={{
              backgroundColor: step >= 2 ? 'var(--color-accent)' : 'var(--color-border)',
            }}>
              {step > 2 ? <CheckCircle className="w-6 h-6" /> : '2'}
            </div>
            <div className="flex-1 h-1" style={{ backgroundColor: step > 2 ? 'var(--color-accent)' : 'var(--color-border)' }} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold transition ${
              step >= 3
                ? 'text-white'
                : 'text-fg'
            }`} style={{
              backgroundColor: step >= 3 ? 'var(--color-accent)' : 'var(--color-border)',
            }}>
              {step > 3 ? <CheckCircle className="w-6 h-6" /> : '3'}
            </div>
          </div>
          <div className="flex justify-between text-sm mt-3" style={{ color: 'var(--color-muted)' }}>
            <span>Praxisinfo</span>
            <span>Team einladen</span>
            <span>Bestätigung</span>
          </div>
        </div>

        {/* Step 1: Praxisinfo */}
        {step === 1 && (
          <Card className="p-8 mb-8" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
              <h2 className="text-2xl font-bold">Praxisinformationen</h2>
            </div>
            <p className="mb-6" style={{ color: 'var(--color-muted)' }}>
              Geben Sie die Grundinformationen Ihrer Tierarztpraxis ein.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Praxisname*</label>
                <input
                  type="text"
                  placeholder="z.B. Tierarztpraxis Dr. Müller"
                  value={formData.practiceName}
                  onChange={(e) => handleInputChange('practiceName', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border transition"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-fg)',
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Adresse*</label>
                <input
                  type="text"
                  placeholder="z.B. Musterstraße 123, 10115 Berlin"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border transition"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-fg)',
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">E-Mail*</label>
                  <input
                    type="email"
                    placeholder="praxis@example.de"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border transition"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-bg)',
                      color: 'var(--color-fg)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Telefon</label>
                  <input
                    type="tel"
                    placeholder="+49 30 123456"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border transition"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-bg)',
                      color: 'var(--color-fg)',
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <Button
                variant="default"
                size="lg"
                onClick={() => setStep(2)}
                disabled={!formData.practiceName || !formData.address || !formData.email}
                className="flex-1"
              >
                Weiter
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={handleSkip}
                className="flex-1"
              >
                Überspringen
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Team einladen */}
        {step === 2 && (
          <Card className="p-8 mb-8" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
              <h2 className="text-2xl font-bold">Team einladen (Optional)</h2>
            </div>
            <p className="mb-6" style={{ color: 'var(--color-muted)' }}>
              Laden Sie Ihre Mitarbeiter ein, damit sie gemeinsam mit Ihnen arbeiten können.
            </p>
            <div className="space-y-3">
              {formData.teamEmails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="team@example.de"
                    value={email}
                    onChange={(e) => handleTeamEmailChange(index, e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border transition"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-bg)',
                      color: 'var(--color-fg)',
                    }}
                  />
                  {formData.teamEmails.length > 1 && (
                    <Button
                      variant="ghost"
                      onClick={() => removeTeamEmail(index)}
                    >
                      Entfernen
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addTeamEmail}
              className="mt-4"
            >
              + Weiteres Mitglied
            </Button>
            <div className="flex gap-4 mt-8">
              <Button
                variant="default"
                size="lg"
                onClick={handleComplete}
                className="flex-1"
              >
                Anfrage einreichen
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Zurück
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Bestätigung */}
        {step === 3 && (
          <Card className="p-8 text-center" style={{ backgroundColor: 'var(--color-accent-soft)', borderColor: 'var(--color-accent)' }}>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent)' }}>
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-3">Anfrage eingereicht!</h2>
            <p className="mb-2" style={{ color: 'var(--color-fg)' }}>
              Ihre Anfrage zur Praxiserstellung wurde erfolgreich eingereicht.
            </p>
            <p className="mb-8" style={{ color: 'var(--color-muted)' }}>
              Unser Admin-Team wird Ihre Praxis <strong>{formData.practiceName}</strong> in Kürze bestätigen.
              Sie erhalten eine E-Mail an <strong>{formData.email}</strong> sobald alles bereit ist.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-left" style={{ backgroundColor: 'var(--color-accent-soft)', borderColor: 'var(--color-accent)' }}>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Mail className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                Zusammenfassung
              </h3>
              <div className="space-y-2 text-sm" style={{ color: 'var(--color-fg)' }}>
                <p><strong>Praxisname:</strong> {formData.practiceName}</p>
                <p><strong>Adresse:</strong> {formData.address}</p>
                <p><strong>E-Mail:</strong> {formData.email}</p>
                {formData.phone && <p><strong>Telefon:</strong> {formData.phone}</p>}
                {formData.teamEmails.some(e => e.trim()) && (
                  <p><strong>Team:</strong> {formData.teamEmails.filter(e => e.trim()).join(", ")}</p>
                )}
              </div>
            </div>
            <Button
              variant="default"
              size="lg"
              onClick={() => router.push("/sign-in")}
              className="w-full"
            >
              Zum Login
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
