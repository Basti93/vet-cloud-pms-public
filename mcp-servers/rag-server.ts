#!/usr/bin/env node

/**
 * MCP Server: Local RAG Search
 *
 * Exposes semantic and lexical search over the local codebase index.
 * Enables Claude to query code patterns, understand implementations, and find definitions
 * without relying on Explore agents or manual grep commands.
 *
 * Tools:
 * - rag_search: Semantic + lexical search with vector + keyword reranking
 * - rag_open: Get full file context (up to N lines around match)
 * - rag_reindex: Refresh the index after git operations
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import * as lancedb from "@lancedb/lancedb";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Config
const REPO_ROOT = path.resolve(__dirname, "..");
const RAG_DIR = path.join(REPO_ROOT, ".rag");
const LANCEDB_DIR = path.join(RAG_DIR, "lancedb");
const CHUNKS_PATH = path.join(RAG_DIR, "chunks.jsonl");
const MANIFEST_PATH = path.join(RAG_DIR, "manifest.json");
const TABLE_NAME = "code_chunks";
const VECTOR_DIMENSIONS = 384;

// Types
interface RagChunk {
  id: string;
  path: string;
  lineStart: number;
  lineEnd: number;
  extension: string;
  text: string;
  vector: number[];
  indexedAt: string;
}

interface SearchResult extends Omit<RagChunk, "vector" | "indexedAt"> {
  _distance?: number;
  lexicalScore?: number;
}

// Tokenization and embedding (same as scripts/dev-rag/shared.ts)
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_:/.-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function embedText(text: string): number[] {
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

function lexicalScore(query: string, candidate: Pick<RagChunk, "path" | "text">): number {
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

// MCP Server
const server = new Server(
  { name: "local-rag-server", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "rag_search",
        description:
          "Search the local codebase using semantic (vector) and lexical (keyword) search. Returns the most relevant code chunks.",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: {
              type: "string",
              description:
                "Natural language search query or code pattern. Examples: 'How does permission caching work?', 'tenant deletion', 'invite acceptance flow'",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 8, max: 50)",
              default: 8,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "rag_open",
        description:
          "Get the full file context around a search result. Useful for understanding complete functions or implementations.",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "File path (relative to repo root, e.g., 'apps/web/src/lib/auth/permissions.ts')",
            },
            lineStart: {
              type: "number",
              description: "Starting line number",
            },
            contextLines: {
              type: "number",
              description: "Number of lines to show before and after the match (default: 20)",
              default: 20,
            },
          },
          required: ["path", "lineStart"],
        },
      },
      {
        name: "rag_reindex",
        description:
          "Manually refresh the RAG index. Useful after git operations or when the index is stale. Runs: npm run rag:refresh",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request;

  if (name === "rag_search") {
    const query = (args as any).query as string;
    const limit = Math.min((args as any).limit ?? 8, 50);

    try {
      // Check index exists
      await fs.access(MANIFEST_PATH);

      // Search vectors
      const db = await lancedb.connect(LANCEDB_DIR);
      const table = await db.openTable(TABLE_NAME);
      const vectorResults = (await table
        .vectorSearch(embedText(query))
        .limit(Math.max(limit * 8, 40))
        .toArray()) as unknown as SearchResult[];

      // Search lexically
      const chunkLines = (await fs.readFile(CHUNKS_PATH, "utf8")).split("\n").filter(Boolean);
      const lexicalResults = chunkLines
        .map((line) => JSON.parse(line) as RagChunk)
        .map((chunk) => ({ ...chunk, lexicalScore: lexicalScore(query, chunk) }))
        .filter((chunk) => chunk.lexicalScore > 0)
        .sort((a, b) => b.lexicalScore - a.lexicalScore)
        .slice(0, Math.max(limit * 4, 20));

      // Merge and rerank
      const merged = new Map<string, SearchResult>();
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
          return (
            (a._distance ?? Number.POSITIVE_INFINITY) - (b._distance ?? Number.POSITIVE_INFINITY)
          );
        })
        .slice(0, limit);

      if (results.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No matching code chunks found." }],
        };
      }

      const output = results
        .map(
          (r, i) =>
            `${i + 1}. ${r.path}:${r.lineStart}-${r.lineEnd} (distance=${r._distance?.toFixed(2) ?? "N/A"})\n${r.text.slice(0, 400)}${r.text.length > 400 ? "..." : ""}`
        )
        .join("\n\n");

      return {
        content: [{ type: "text" as const, text: output }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Search failed: ${error instanceof Error ? error.message : String(error)}. Try running: npm run rag:index`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "rag_open") {
    const filePath = (args as any).path as string;
    const lineStart = (args as any).lineStart as number;
    const contextLines = (args as any).contextLines ?? 20;

    try {
      const absolutePath = path.join(REPO_ROOT, filePath);
      const content = await fs.readFile(absolutePath, "utf8");
      const lines = content.split(/\r?\n/);

      const start = Math.max(0, lineStart - 1 - contextLines);
      const end = Math.min(lines.length, lineStart + contextLines);
      const context = lines.slice(start, end);

      const output = context
        .map((line, i) => {
          const lineNum = start + i + 1;
          const isMatch = lineNum >= lineStart && lineNum <= (lineStart || lineNum);
          const prefix = isMatch ? "→ " : "  ";
          return `${prefix}${String(lineNum).padStart(4, " ")} | ${line}`;
        })
        .join("\n");

      return {
        content: [{ type: "text" as const, text: `File: ${filePath}\n\n${output}` }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to open file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "rag_reindex") {
    try {
      const { execSync } = await import("node:child_process");
      execSync("npm run rag:refresh", { cwd: REPO_ROOT, stdio: "inherit" });
      return {
        content: [{ type: "text" as const, text: "RAG index refreshed successfully." }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Reindex failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Local RAG MCP Server started on stdio");
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
