"use client";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { CheckCircle, Building2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [practiceName, setPracticeName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const createTenant = trpc.tenant.create.useMutation({
    onSuccess: () => {
      setShowSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    },
    onError: (error) => {
      alert("Fehler beim Erstellen der Praxis: " + error.message);
      setIsSubmitting(false);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!practiceName.trim()) return;

    setIsSubmitting(true);
    await createTenant.mutateAsync({
      name: practiceName,
    });
  };

  const handleSkip = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)' }}>
      <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Willkommen, {user?.firstName || "Nutzer"}!
          </h1>
          <p style={{ color: 'var(--color-muted)' }}>
            Erstellen Sie Ihre Tierarztpraxis in 30 Sekunden.
          </p>
        </div>

        {!showSuccess ? (
          <Card className="p-8" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
              <h2 className="text-2xl font-bold">Praxisnamen eingeben</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Praxisname*</label>
                <input
                  type="text"
                  placeholder="z.B. Tierarztpraxis Dr. Müller"
                  value={practiceName}
                  onChange={(e) => setPracticeName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-lg border transition text-base"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-fg)',
                  }}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  size="lg"
                  disabled={!practiceName.trim() || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Wird erstellt...
                    </>
                  ) : (
                    "Praxis erstellen"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Überspringen
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card className="p-8 text-center" style={{ backgroundColor: 'var(--color-accent-soft)', borderColor: 'var(--color-accent)' }}>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent)' }}>
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-3">Praxis erstellt!</h2>
            <p style={{ color: 'var(--color-muted)' }}>
              <strong>{practiceName}</strong> wurde erfolgreich erstellt.
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-muted)' }}>
              Sie werden zum Dashboard weitergeleitet...
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
