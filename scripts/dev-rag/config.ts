import path from "node:path";

export const REPO_ROOT = process.cwd();
export const RAG_DIR = path.join(REPO_ROOT, ".rag");
export const LANCEDB_DIR = path.join(RAG_DIR, "lancedb");
export const MANIFEST_PATH = path.join(RAG_DIR, "manifest.json");
export const CHUNKS_PATH = path.join(RAG_DIR, "chunks.jsonl");
export const TABLE_NAME = "repo_chunks";
export const VECTOR_DIMENSIONS = 384;

export const INDEXABLE_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".yml",
  ".yaml",
  ".css",
]);

export const EXCLUDED_DIRS = new Set([
  ".git",
  ".claude",
  ".next",
  ".rag",
  ".turbo",
  ".vercel",
  ".vitest",
  "coverage",
  "dist",
  "build",
  "out",
  "node_modules",
]);

export const EXCLUDED_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

export function shouldSkipFile(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  if (EXCLUDED_FILES.has(basename)) return true;
  if (basename.startsWith(".env")) return true;
  if (basename.endsWith(".pem")) return true;
  if (basename.endsWith(".tsbuildinfo")) return true;
  return false;
}
