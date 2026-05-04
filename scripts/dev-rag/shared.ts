import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  EXCLUDED_DIRS,
  INDEXABLE_EXTENSIONS,
  REPO_ROOT,
  VECTOR_DIMENSIONS,
  shouldSkipFile,
} from "./config";

export interface RagChunk {
  id: string;
  path: string;
  lineStart: number;
  lineEnd: number;
  extension: string;
  text: string;
  vector: number[];
  indexedAt: string;
}

export async function walkIndexableFiles(dir = REPO_ROOT): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(REPO_ROOT, absolutePath);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        files.push(...(await walkIndexableFiles(absolutePath)));
      }
      continue;
    }

    if (!entry.isFile()) continue;
    if (shouldSkipFile(relativePath)) continue;
    if (!INDEXABLE_EXTENSIONS.has(path.extname(entry.name))) continue;

    files.push(absolutePath);
  }

  return files.sort();
}

export function chunkFile(relativePath: string, content: string): Array<Omit<RagChunk, "vector" | "indexedAt">> {
  const lines = content.split(/\r?\n/);
  const chunks: Array<Omit<RagChunk, "vector" | "indexedAt">> = [];
  const maxChars = 1_800;
  const overlapLines = 8;

  let start = 0;
  while (start < lines.length) {
    let end = start;
    let charCount = 0;

    while (end < lines.length && charCount < maxChars) {
      charCount += lines[end].length + 1;
      end += 1;
    }

    const text = lines.slice(start, end).join("\n").trim();
    if (text.length > 0) {
      const idSource = `${relativePath}:${start + 1}:${end}:${text}`;
      chunks.push({
        id: createHash("sha1").update(idSource).digest("hex"),
        path: relativePath,
        lineStart: start + 1,
        lineEnd: end,
        extension: path.extname(relativePath),
        text,
      });
    }

    if (end >= lines.length) break;
    start = Math.max(end - overlapLines, start + 1);
  }

  return chunks;
}

export function embedText(text: string): number[] {
  const vector = new Array<number>(VECTOR_DIMENSIONS).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const hash = createHash("sha256").update(token).digest();
    const index = hash.readUInt32BE(0) % VECTOR_DIMENSIONS;
    const sign = hash[4] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) return vector;
  return vector.map((value) => value / magnitude);
}

export function preview(text: string, maxLength = 280): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}...` : compact;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_:/.-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

export function lexicalScore(query: string, candidate: Pick<RagChunk, "path" | "text">): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;

  const candidateText = `${candidate.path}\n${candidate.text}`.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (candidate.path.toLowerCase().includes(token)) score += 4;
    if (candidateText.includes(token)) score += 1;
  }
  return score / queryTokens.size;
}
