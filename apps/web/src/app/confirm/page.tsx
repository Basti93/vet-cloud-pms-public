'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

type ConfirmationStatus = 'loading' | 'success' | 'error' | 'invalid-token';

export default function ConfirmationPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<ConfirmationStatus>('loading');
  const [message, setMessage] = useState('');

  const confirmAppointmentMutation = trpc.appointments.confirmFromEmail.useMutation({
    onSuccess: () => {
      setStatus('success');
      setMessage('Ihr Termin wurde erfolgreich bestätigt!');
    },
    onError: (error) => {
      setStatus('error');
      setMessage(error.message || 'Fehler bei der Bestätigung des Termins');
    },
  });

  useEffect(() => {
    const confirmAppointment = async () => {
      if (!token) {
        setStatus('invalid-token');
        setMessage('Ungültiger oder fehlender Bestätigungslink');
        return;
      }

      // Extract appointmentId from token payload (without verification on client)
      // Server will verify the token signature and expiry
      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          setStatus('invalid-token');
          setMessage('Ungültiger Bestätigungslink');
          return;
        }

        // Decode payload (without verification) to get appointmentId
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64').toString('utf-8')
        );

        // Call mutation to confirm appointment (server will verify token)
        confirmAppointmentMutation.mutate({
          appointmentId: payload.appointmentId,
          token,
        });
      } catch (error) {
        setStatus('invalid-token');
        setMessage('Ungültiger Bestätigungslink');
      }
    };

    confirmAppointment();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        {status === 'loading' && (
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-indigo-600 animate-spin" />
            <h1 className="text-xl font-bold text-gray-900">Bestätigung wird verarbeitet...</h1>
            <p className="text-gray-600 text-sm">Bitte warten Sie einen Moment</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
            <h1 className="text-xl font-bold text-gray-900">Termin bestätigt!</h1>
            <p className="text-gray-600 text-sm">{message}</p>
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800">
                Sie erhalten in Kürze eine Bestätigungsemail von der Tierarztpraxis.
              </p>
            </div>
            <a
              href="/"
              className="block mt-6 text-center bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Zurück zur Startseite
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center space-y-4">
            <XCircle className="w-12 h-12 mx-auto text-red-600" />
            <h1 className="text-xl font-bold text-gray-900">Fehler</h1>
            <p className="text-gray-600 text-sm">{message}</p>
            <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-800">
                Bitte buchen Sie einen neuen Termin oder kontaktieren Sie die Tierarztpraxis direkt.
              </p>
            </div>
            <a
              href="/"
              className="block mt-6 text-center bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Neuer Termin
            </a>
          </div>
        )}

        {status === 'invalid-token' && (
          <div className="text-center space-y-4">
            <XCircle className="w-12 h-12 mx-auto text-red-600" />
            <h1 className="text-xl font-bold text-gray-900">Ungültig</h1>
            <p className="text-gray-600 text-sm">{message}</p>
            <a
              href="/"
              className="block mt-6 text-center bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Zur Buchungsseite
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
