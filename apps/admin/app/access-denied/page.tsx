import { SignOutButton } from "@clerk/nextjs";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-4xl">🚫</div>
        <h1 className="mb-2 text-xl font-semibold text-gray-900">
          Kein Zugriff
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Ihr Konto ist nicht für den Zugriff auf das Admin-Dashboard
          berechtigt. Bitte wenden Sie sich an den Systemadministrator.
        </p>
        <SignOutButton redirectUrl="/sign-in">
          <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Abmelden
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}
