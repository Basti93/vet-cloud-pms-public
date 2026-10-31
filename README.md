# Vet Cloud PMS

Open-Source-Praxisverwaltung für Tierarztpraxen: Termine, Patienten, Impfungen und Online-Buchung.

## 🚀 Quick Start

```bash
corepack enable
pnpm install
pnpm run dev        # apps/web auf http://localhost:3000
```

Weitere wichtige Checks aus dem Repo-Root:

```bash
pnpm --filter @vet-cloud/web run typecheck
pnpm run lint
pnpm run rag:search -- "tenant isolation"
```

Schemaänderungen laufen über Drizzle in `apps/web`: `pnpm --filter @vet-cloud/web run db:generate` und Migrationen werden beim Containerstart automatisch ausgeführt.

## 📋 Aktuelle Kernfunktionen

✅ **Multi-Tenant Setup** — Isolierte Daten pro Tierarztpraxis  
✅ **Terminplanung (Kalender)** — FullCalendar Integration, echte tRPC-Daten  
✅ **Patientenverwaltung** — Listenseite, Detailseite, CRUD-Operationen  
✅ **Clerk Authentication** — EU-basierte Authentifizierung (Frankfurt)  
✅ **AI Voice Integration** — Vapi für Sprachempfang (Deutsche TTS/STT)  
✅ **Responsive UI** — Tailwind CSS + shadcn/ui Components  
✅ **Type-Safe APIs** — tRPC v11 mit vollständiger TypeScript-Unterstützung

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS, PostCSS, shadcn/ui |
| **API** | tRPC v11, Node.js |
| **Database** | PostgreSQL (Frankfurt), Drizzle ORM |
| **Auth** | Clerk (EU Region) |
| **Voice** | Vapi AI (German Assistant) |
| **Monorepo** | Turborepo |
| **Deployment** | Container deployments |

## 📁 Project Structure

```
apps/web/
├── src/
│   ├── app/                 # Next.js App Router (Pages, Layouts)
│   ├── components/          # React Components (UI, Forms, etc.)
│   ├── lib/
│   │   ├── db/             # Drizzle Schema, DB-Typen
│   │   ├── trpc/           # tRPC Router, Procedures
│   │   └── utils/          # Helper Functions
│   ├── styles/             # Global Styles
│   └── middleware.ts       # Clerk Authentication Middleware
├── public/                 # Static Assets
├── .env.local             # Environment Variables
├── drizzle.config.ts      # Drizzle Kit Config
├── next.config.js         # Next.js Config
├── tsconfig.json          # TypeScript Config
└── package.json
```

## 🔧 Environment Setup

Kopiere `.env.local.example` → `.env.local` und setze:

```env
# Database (PostgreSQL)
DATABASE_URL=postgresql://user:***@host:5432/vet_cloud_pms?sslmode=require

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=REDACTED
CLERK_SECRET_KEY=REDACTED
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Vapi AI Voice
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your-vapi-public-key-here
NEXT_PUBLIC_VAPI_ASSISTANT_ID=your-vapi-assistant-id-here
NEXT_PUBLIC_VAPI_PHONE_NUMBER=your-vapi-phone-number-here
```

## 🗄 Database Schema

Drizzle ORM mit PostgreSQL:

- **tenants** — Tierarztpraxen (Multi-Tenant)
- **users** — Benutzer pro Tenant
- **owners** — Praxis-Inhaber
- **patients** — Tiere/Patienten
- **appointments** — Termine
- **voice_calls** — Vapi Call-Logs
- **audit_logs** — Änderungsverlauf

Migration & Seeding:
- `npm run db:push` (Schema)
- `npm run db:seed` (globale Referenzdaten)
- `npm run db:seed:demo` (Demo-Tenant Reset/Reseed)

## 🔗 API Routes (tRPC)

Alle über `/api/trpc/`:

- `appointments.listWithDetails` — Termine mit Patienten-Infos
- `appointments.create` — Neuer Termin
- `patients.list` — Alle Patienten eines Tenants
- `patients.create` — Neuer Patient

Typsicher dank tRPC v11!

## 🌐 Deployment

- `staging` deployt automatisch in die Staging-Umgebung.
- `main` deployt automatisch in Produktion.
- Container führen Drizzle-Migrationen beim Start aus; keine manuellen Produktionsmigrationen aus Agent-Sessions.

## 📚 Documentation

### Source of truth
- **[`openspec/specs/`](openspec/specs/)** — Standing product, architecture, deployment, testing, and implementation requirements.

## ✅ Commit Convention

Dieses Repo erzwingt **Conventional Commits** per Husky `commit-msg` Hook.

Format:

```text
type(scope): subject
```

Erlaubte `type` Werte:
`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `security`

Beispiele:

```text
feat(web): add tenant filter
fix(admin): forward auth header in proxy
chore: update lockfile
```
