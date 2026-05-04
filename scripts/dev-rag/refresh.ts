import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { MANIFEST_PATH } from "./config";
import { walkIndexableFiles } from "./shared";

const MAX_INDEX_AGE_MS = 24 * 60 * 60 * 1000;

interface Manifest {
  indexedAt: string;
}

async function readManifest(): Promise<Manifest | null> {
  try {
    return JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8")) as Manifest;
  } catch {
    return null;
  }
}

async function newestIndexableFileMtime() {
  const files = await walkIndexableFiles();
  let newest = 0;

  for (const file of files) {
    const stat = await fs.stat(file);
    newest = Math.max(newest, stat.mtimeMs);
  }

  return newest;
}

function runIndexer() {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["run", "rag:index"], {
      stdio: "inherit",
      shell: false,
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`rag:index exited with code ${code}`));
    });
  });
}

async function main() {
  const manifest = await readManifest();
  if (!manifest?.indexedAt) {
    console.log("RAG index missing. Rebuilding...");
    await runIndexer();
    return;
  }

  const indexedAtMs = new Date(manifest.indexedAt).getTime();
  if (!Number.isFinite(indexedAtMs)) {
    console.log("RAG manifest is invalid. Rebuilding...");
    await runIndexer();
    return;
  }

  const ageMs = Date.now() - indexedAtMs;
  if (ageMs > MAX_INDEX_AGE_MS) {
    console.log("RAG index is older than 24h. Rebuilding...");
    await runIndexer();
    return;
  }

  const newestFileMtime = await newestIndexableFileMtime();
  if (newestFileMtime > indexedAtMs) {
    console.log("RAG index is stale after repository changes. Rebuilding...");
    await runIndexer();
    return;
  }

  console.log("RAG index fresh.");
}

main().catch((error) => {
  console.warn("RAG refresh skipped:", error instanceof Error ? error.message : error);
  process.exit(0);
});

