import fs from "node:fs/promises";
import path from "node:path";
import * as lancedb from "@lancedb/lancedb";
import { CHUNKS_PATH, LANCEDB_DIR, MANIFEST_PATH, RAG_DIR, REPO_ROOT, TABLE_NAME, VECTOR_DIMENSIONS } from "./config";
import { chunkFile, embedText, walkIndexableFiles, type RagChunk } from "./shared";

async function main() {
  await fs.mkdir(RAG_DIR, { recursive: true });
  await fs.mkdir(LANCEDB_DIR, { recursive: true });

  const files = await walkIndexableFiles();
  const indexedAt = new Date().toISOString();
  const chunks: RagChunk[] = [];

  for (const absolutePath of files) {
    const relativePath = path.relative(REPO_ROOT, absolutePath);
    const content = await fs.readFile(absolutePath, "utf8");
    const fileChunks = chunkFile(relativePath, content);

    for (const chunk of fileChunks) {
      chunks.push({
        ...chunk,
        indexedAt,
        vector: embedText(`${chunk.path}\n${chunk.text}`),
      });
    }
  }

  if (chunks.length === 0) {
    throw new Error("No indexable chunks found.");
  }

  const db = await lancedb.connect(LANCEDB_DIR);
  const tables = await db.tableNames();
  if (tables.includes(TABLE_NAME)) {
    await db.dropTable(TABLE_NAME);
  }
  await db.createTable(TABLE_NAME, chunks);
  await fs.writeFile(CHUNKS_PATH, chunks.map((chunk) => JSON.stringify(chunk)).join("\n"));

  await fs.writeFile(
    MANIFEST_PATH,
    JSON.stringify(
      {
        indexedAt,
        files: files.length,
        chunks: chunks.length,
        vectorDimensions: VECTOR_DIMENSIONS,
        table: TABLE_NAME,
      },
      null,
      2
    )
  );

  console.log(`Indexed ${chunks.length} chunks from ${files.length} files into ${path.relative(REPO_ROOT, LANCEDB_DIR)}.`);
}

main().catch((error) => {
  console.error("Failed to build dev RAG index:", error);
  process.exit(1);
});
