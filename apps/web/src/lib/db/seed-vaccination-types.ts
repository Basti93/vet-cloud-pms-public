/**
 * Seed data for vaccination_types table.
 * Based on STIKO Vet (Ständige Impfkommission Veterinärmedizin) recommendations
 * for the DACH market.
 *
 * Run via: npm run db:seed-vax-types
 * Safe to re-run (upsert on code).
 */

import { db } from "./client";
import { vaccinationTypes } from "./schema";
import { sql } from "drizzle-orm";
import { pathToFileURL } from "url";

const TYPES = [
  // ─── HUND — Core ───────────────────────────────────────────────────────────
  {
    code: "SHP",
    name: "Staupe + Hepatitis + Parvovirose",
    species: "Hund",
    category: "core",
    defaultIntervalMonths: 36,
    seriesDoses: 3,
    minIntervalDays: 28,
    sortOrder: 10,
    notes: "Grundimmunisierung: 3 Dosen (8, 12, 16 Wo.) → Auffrischung mit 15 Mon. → alle 3 Jahre",
  },
  {
    code: "SHPPi",
    name: "Staupe + Hepatitis + Parvovirose + Parainfluenza",
    species: "Hund",
    category: "core",
    defaultIntervalMonths: 36,
    seriesDoses: 3,
    minIntervalDays: 28,
    sortOrder: 11,
    notes: "Häufigste Kombi-Impfung (z. B. Nobivac DHPPi)",
  },
  {
    code: "L4",
    name: "Leptospirose L4",
    species: "Hund",
    category: "recommended",
    defaultIntervalMonths: 12,
    sortOrder: 20,
    notes: "4 Serovare (Icterohaemorrhagiae, Canicola, Grippotyphosa, Australis). Jährlich — kurze Immunität!",
  },
  {
    code: "L2",
    name: "Leptospirose L2",
    species: "Hund",
    category: "recommended",
    defaultIntervalMonths: 12,
    sortOrder: 21,
    notes: "2 Serovare (Icterohaemorrhagiae, Canicola). Älteres Schema, L4 bevorzugt.",
  },
  {
    code: "Tollwut-H",
    name: "Tollwut (Hund)",
    species: "Hund",
    category: "core",
    defaultIntervalMonths: 36,
    requiresBatchNumber: true,
    sortOrder: 30,
    notes: "Pflicht für EU-Heimtierausweis und Auslandsreisen. Chargennummer erforderlich.",
  },
  {
    code: "BB",
    name: "Bordetella + Parainfluenza (Zwingerhusten)",
    species: "Hund",
    category: "non-core",
    defaultIntervalMonths: 12,
    sortOrder: 40,
    notes: "Empfohlen vor Aufenthalt in Tierpension oder Hundeausstellungen.",
  },
  {
    code: "Borrelia",
    name: "Borreliose (Lyme-Borreliose)",
    species: "Hund",
    category: "non-core",
    defaultIntervalMonths: 12,
    sortOrder: 50,
    notes: "Für Hunde in zeckenreichen Gebieten (Süddeutschland, Österreich, Schweiz).",
  },
  {
    code: "Leish",
    name: "Leishmaniose",
    species: "Hund",
    category: "non-core",
    defaultIntervalMonths: 12,
    sortOrder: 60,
    notes: "Für Hunde mit Reiseaktivität ins Mittelmeerraum.",
  },
  {
    code: "CIV",
    name: "Hundeinfluenza (CIV)",
    species: "Hund",
    category: "non-core",
    defaultIntervalMonths: 12,
    sortOrder: 70,
    notes: "Selten in Deutschland. Relevant bei Ausstellungshunden.",
  },

  // ─── KATZE — Core ──────────────────────────────────────────────────────────
  {
    code: "RCP",
    name: "Katzenschnupfen + Panleukopenie (RCP)",
    species: "Katze",
    category: "core",
    defaultIntervalMonths: 36,
    seriesDoses: 3,
    minIntervalDays: 21,
    sortOrder: 10,
    notes: "Rhinotracheitis (FHV-1) + Calicivirus (FCV) + Panleukopenie (FPV). Grundimmun.: 8, 12, 16 Wo. → alle 3 Jahre.",
  },
  {
    code: "FeLV",
    name: "Katzenleukoseleukovirose (FeLV)",
    species: "Katze",
    category: "recommended",
    defaultIntervalMonths: 12,
    sortOrder: 20,
    notes: "Empfohlen für Freigänger und Katzen mit Außenkontakt.",
  },
  {
    code: "Tollwut-K",
    name: "Tollwut (Katze)",
    species: "Katze",
    category: "non-core",
    defaultIntervalMonths: 36,
    requiresBatchNumber: true,
    sortOrder: 30,
    notes: "Für Freigänger in Risikogebieten oder bei Auslandsreisen.",
  },
  {
    code: "Chlamydia",
    name: "Chlamydiose (Chlamydia felis)",
    species: "Katze",
    category: "non-core",
    defaultIntervalMonths: 12,
    sortOrder: 40,
    notes: "Empfohlen in Mehr-Katzen-Haushalten mit bekannter Erkrankungshistorie.",
  },
  {
    code: "FIP",
    name: "FIP (Feline Infektiöse Peritonitis)",
    species: "Katze",
    category: "non-core",
    defaultIntervalMonths: 12,
    sortOrder: 50,
    notes: "Kontrovers — begrenzte Schutzdauer und Wirksamkeit.",
  },

  // ─── KANINCHEN ─────────────────────────────────────────────────────────────
  {
    code: "Myxo",
    name: "Myxomatose",
    species: "Kaninchen",
    category: "core",
    defaultIntervalMonths: 6,
    sortOrder: 10,
    notes: "Halbjährlich! Besonders wichtig April–Oktober (Mücken-/Insektensaison).",
  },
  {
    code: "RHD1",
    name: "Chinaseuche RHD Typ 1 (klassisch)",
    species: "Kaninchen",
    category: "core",
    defaultIntervalMonths: 12,
    sortOrder: 20,
  },
  {
    code: "RHD2",
    name: "RHD Typ 2 (RHDV2, neuartig)",
    species: "Kaninchen",
    category: "core",
    defaultIntervalMonths: 12,
    sortOrder: 21,
    notes: "Separate Impfung — nicht mit RHD1-Impfstoffen kreuzgeschützt. Mindestabstand zu RHD1: 14 Tage.",
  },
  {
    code: "Myxo-RHD",
    name: "Myxomatose + RHD Typ 1 (Kombination)",
    species: "Kaninchen",
    category: "core",
    defaultIntervalMonths: 12,
    sortOrder: 15,
    notes: "Jahres-Kombi (z.B. Nobivac Myxo-RHD). Kein Schutz gegen RHD2 — zusätzliche RHD2-Impfung nötig.",
  },

  // ─── PFERD (wenn Großtierpraxis) ───────────────────────────────────────────
  {
    code: "EqInfluenza",
    name: "Pferdeinfluenza (Influenza equi)",
    species: "Pferd",
    category: "core",
    defaultIntervalMonths: 6,
    sortOrder: 10,
    notes: "Halbjährlich. FEI-Turniere: max. 6 Monate + 21 Tage zwischen Impfung und Wettkampf.",
  },
  {
    code: "EqTetanus",
    name: "Tetanus (Pferd)",
    species: "Pferd",
    category: "core",
    defaultIntervalMonths: 24,
    sortOrder: 20,
  },
  {
    code: "EHV",
    name: "Equines Herpesvirus (EHV 1+4)",
    species: "Pferd",
    category: "recommended",
    defaultIntervalMonths: 6,
    sortOrder: 30,
    notes: "Halbjährlich für Zuchtstuten und Hengste im Turnierbetrieb.",
  },
  {
    code: "Tollwut-P",
    name: "Tollwut (Pferd)",
    species: "Pferd",
    category: "non-core",
    defaultIntervalMonths: 12,
    requiresBatchNumber: true,
    sortOrder: 40,
  },

  // ─── FRETTCHEN ─────────────────────────────────────────────────────────────
  {
    code: "Staupe-F",
    name: "Staupe (Frettchen)",
    species: "Frettchen",
    category: "core",
    defaultIntervalMonths: 12,
    sortOrder: 10,
    notes: "Jährliche Auffrischung — Frettchen sind hoch empfänglich für CDV.",
  },
  {
    code: "Tollwut-F",
    name: "Tollwut (Frettchen)",
    species: "Frettchen",
    category: "core",
    defaultIntervalMonths: 12,
    requiresBatchNumber: true,
    sortOrder: 20,
  },
] as const;

export async function seedVaccinationTypes(): Promise<void> {
  console.log(`Seeding ${TYPES.length} vaccination types...`);

  for (const t of TYPES) {
    await db
      .insert(vaccinationTypes)
      .values({
        code: t.code,
        name: t.name,
        species: t.species,
        category: t.category,
        defaultIntervalMonths: t.defaultIntervalMonths,
        seriesDoses: "seriesDoses" in t ? t.seriesDoses : 1,
        minIntervalDays: "minIntervalDays" in t ? t.minIntervalDays : null,
        requiresBatchNumber: "requiresBatchNumber" in t ? t.requiresBatchNumber : false,
        sortOrder: t.sortOrder,
        notes: "notes" in t ? t.notes : null,
      })
      .onConflictDoUpdate({
        target: vaccinationTypes.code,
        set: {
          name: sql`excluded.name`,
          species: sql`excluded.species`,
          category: sql`excluded.category`,
          defaultIntervalMonths: sql`excluded.default_interval_months`,
          seriesDoses: sql`excluded.series_doses`,
          minIntervalDays: sql`excluded.min_interval_days`,
          requiresBatchNumber: sql`excluded.requires_batch_number`,
          sortOrder: sql`excluded.sort_order`,
          notes: sql`excluded.notes`,
        },
      });
  }

  console.log("✅ Vaccination types seeded.");
}

// Run only when executed directly (tsx src/lib/db/seed-vaccination-types.ts).
// When this module is imported by scripts/seed.ts, it must not exit the process.
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seedVaccinationTypes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
