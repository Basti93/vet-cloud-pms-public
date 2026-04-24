# Vet Cloud PMS

Cloud-basiertes Veterinary Practice Management System (SaaS) für Tierarztpraxen in DACH.  
**Phase:** 1 (Validation Demo) | **Status:** Funktionsfähig, lokal & in Entwicklung

## 🚀 Quick Start

```bash
cd apps/web
npm install
npm run db:push    # Neon PostgreSQL Schema initialisieren
npm run db:seed    # Demo-Daten laden
npm run dev        # http://localhost:3000
```

## 📋 Features (Phase 1)

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
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS, PostCSS, shadcn/ui |
| **API** | tRPC v11, Node.js |
| **Database** | Neon PostgreSQL (EU/Frankfurt), Drizzle ORM |
| **Auth** | Clerk (EU Region) |
| **Voice** | Vapi AI (German Assistant) |
| **Monorepo** | Turborepo |
| **Deployment** | Vercel (Phase 2) / Hetzner (Production) |

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
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@ep-xxx.eu-central-1.neon.tech/vet_cloud_pms?sslmode=require

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

Migration & Seeding: `npm run db:push` + `npm run db:seed`

## 🔗 API Routes (tRPC)

Alle über `/api/trpc/`:

- `appointments.listWithDetails` — Termine mit Patienten-Infos
- `appointments.create` — Neuer Termin
- `patients.list` — Alle Patienten eines Tenants
- `patients.create` — Neuer Patient

Typsicher dank tRPC v11!

## 🌐 Deployment (Phase 2)

**Vercel** (Staging):
```bash
git push → Automatic Deploy
```

**Hetzner/Docker** (Production):
- Docker Image bauen
- PostgreSQL on Neon (bleibt extern)
- Umgebungsvariablen via Hetzner Console

Siehe `DEPLOYMENT.md` für Details.

## 🤝 Team

- **Maintainer** — Senior Fullstack Dev, Architecture  
  Email: user@example.com
- **Product** — Product Owner, Sales  
  (Kontakt wird hinzugefügt)

## 📚 Weitere Docs

- `SETUP.md` — Detaillierte Installationsanleitung
- `DEPLOYMENT.md` — Vercel & Hetzner Setup
- `.env.local.example` — Environment Template
