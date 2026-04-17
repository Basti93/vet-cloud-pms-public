import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function VoicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI-Rezeption</h1>
        <p className="text-gray-600 mt-2">KI-gestützte Telefon-Rezeption für Ihre Praxis</p>
      </div>

      <Card className="p-8 text-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Testen Sie unsere AI-Rezeption</h2>
          <p className="text-gray-600 mb-8">
            Rufen Sie unsere KI an und buchen Sie einen Termin. Die KI versteht Deutsch.
          </p>
          <Button size="lg" className="text-lg px-8">📞 AI-Rezeption testen</Button>
          <p className="text-sm text-gray-500 mt-4">Demo-Nummer: wird nach Vapi-Setup konfiguriert</p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Features:</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-green-50 rounded border border-green-200">
            <p className="font-semibold text-green-900">✓ 24/7 Verfügbarkeit</p>
          </div>
          <div className="p-3 bg-green-50 rounded border border-green-200">
            <p className="font-semibold text-green-900">✓ Deutsche Sprache</p>
          </div>
          <div className="p-3 bg-green-50 rounded border border-green-200">
            <p className="font-semibold text-green-900">✓ Kontextverständnis</p>
          </div>
          <div className="p-3 bg-green-50 rounded border border-green-200">
            <p className="font-semibold text-green-900">✓ CRM-Integration</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
