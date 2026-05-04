import fs from "node:fs/promises";
import * as lancedb from "@lancedb/lancedb";
import { CHUNKS_PATH, LANCEDB_DIR, MANIFEST_PATH, TABLE_NAME } from "./config";
import { embedText, lexicalScore, preview, type RagChunk } from "./shared";

interface SearchResult {
  path: string;
  lineStart: number;
  lineEnd: number;
  text: string;
  _distance?: number;
}

function parseArgs() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const limitFlagIndex = args.findIndex((arg) => arg === "--limit" || arg === "-n");
  let limit = 8;

  if (limitFlagIndex >= 0) {
    const value = Number(args[limitFlagIndex + 1]);
    if (Number.isFinite(value) && value > 0) limit = value;
    args.splice(limitFlagIndex, 2);
  }

  return { query: args.join(" ").trim(), limit };
}

async function main() {
  const { query, limit } = parseArgs();
  if (!query) {
    console.error('Usage: npm run rag:search -- "your question" [--limit 8]');
    process.exit(1);
  }

  try {
    await fs.access(MANIFEST_PATH);
  } catch {
    console.error("No dev RAG index found. Run: npm run rag:index");
    process.exit(1);
  }

  const db = await lancedb.connect(LANCEDB_DIR);
  const table = await db.openTable(TABLE_NAME);
  const vectorResults = (await table
    .vectorSearch(embedText(query))
    .limit(Math.max(limit * 8, 40))
    .toArray()) as unknown as SearchResult[];

  const chunkLines = (await fs.readFile(CHUNKS_PATH, "utf8")).split("\n").filter(Boolean);
  const lexicalResults = chunkLines
    .map((line) => JSON.parse(line) as RagChunk)
    .map((chunk) => ({ ...chunk, lexicalScore: lexicalScore(query, chunk) }))
    .filter((chunk) => chunk.lexicalScore > 0)
    .sort((a, b) => b.lexicalScore - a.lexicalScore)
    .slice(0, Math.max(limit * 4, 20));

  const merged = new Map<string, SearchResult & { lexicalScore?: number }>();
  for (const result of vectorResults) {
    merged.set(`${result.path}:${result.lineStart}`, {
      ...result,
      lexicalScore: lexicalScore(query, result),
    });
  }
  for (const result of lexicalResults) {
    const key = `${result.path}:${result.lineStart}`;
    merged.set(key, {
      ...result,
      _distance: merged.get(key)?._distance,
    });
  }

  const results = Array.from(merged.values())
    .sort((a, b) => {
      const lexicalDelta = (b.lexicalScore ?? 0) - (a.lexicalScore ?? 0);
      if (lexicalDelta !== 0) return lexicalDelta;
      return (a._distance ?? Number.POSITIVE_INFINITY) - (b._distance ?? Number.POSITIVE_INFINITY);
    })
    .slice(0, limit);

  if (results.length === 0) {
    console.log("No matching chunks found.");
    return;
  }

  for (const [index, result] of results.entries()) {
    const distance = typeof result._distance === "number" ? ` distance=${result._distance.toFixed(4)}` : "";
    console.log(`\n${index + 1}. ${result.path}:${result.lineStart}${distance}`);
    console.log(preview(result.text));
  }
}

main().catch((error) => {
  console.error("Failed to search dev RAG index:", error);
  process.exit(1);
});
