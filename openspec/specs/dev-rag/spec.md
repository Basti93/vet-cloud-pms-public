# Developer RAG

A local vector + keyword search index over the codebase, stored in `.rag/` (git-ignored), used by Claude Code via MCP tools and by developers via `npm run rag:*` scripts to find code by meaning rather than exact text.

## Requirements

### Requirement: Local Index Storage
The RAG index SHALL be stored locally in `.rag/lancedb` (vector chunks) and `.rag/chunks.jsonl` (keyword reranking). The index directory MUST be excluded from git. No external API key is required to build or query the index.

#### Scenario: Fresh clone or first run
- **WHEN** a developer clones the repository and runs `npm run rag:index`
- **THEN** the `.rag/` directory is created with LanceDB vector data and a `chunks.jsonl` file, using only local deterministic embeddings

### Requirement: Indexed File Types
The indexer SHALL include TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`), Markdown/MDX, JSON, YAML, and CSS files. It MUST exclude `.env*`, `.git`, `.next`, `.rag`, `.turbo`, `node_modules`, coverage/build/dist/out directories, lockfiles, and PEM files.

#### Scenario: Secret files excluded
- **WHEN** the indexer runs
- **THEN** no `.env.local`, `.env.production`, or PEM key file content appears in the index or search results

#### Scenario: Generated output excluded
- **WHEN** the indexer runs
- **THEN** `.next/`, `node_modules/`, `dist/`, and `out/` directories are skipped entirely

### Requirement: Automatic Index Refresh on Git Operations
The index SHALL refresh automatically via Husky `post-merge` and `post-checkout` hooks. The refresh MUST be skipped when the index is less than 24 hours old.

#### Scenario: After git pull
- **WHEN** a developer runs `git pull` and new source files were added
- **THEN** the post-merge hook calls `npm run rag:refresh` and the index is updated to include the new files

#### Scenario: Fresh index skips refresh
- **WHEN** the post-checkout hook runs and the index was built less than 24 hours ago
- **THEN** the refresh is skipped and no re-indexing occurs

### Requirement: MCP Tool Interface
The RAG index MUST be accessible through three MCP tools available to Claude Code: `rag.search(query, limit?)`, `rag.open(path, lineStart, contextLines?)`, and `rag.reindex()`. These tools SHALL be used by AI agents as the primary mechanism for codebase exploration.

#### Scenario: Semantic code search
- **WHEN** Claude Code calls `rag.search("permission cache implementation")`
- **THEN** results are returned within ~500 ms with file path, line numbers, and code snippet for the most relevant chunks

#### Scenario: Open file context around result
- **WHEN** Claude Code calls `rag.open("apps/web/src/lib/auth/permissions.ts", lineStart: 43)`
- **THEN** 20 lines of context before and after line 43 are returned, showing the full function or block

### Requirement: Search Query Guidelines
Queries SHALL use natural language or domain terms, not exact code snippets. Queries MUST be specific enough to rank correctly — overly vague terms (e.g. "code" or "function") produce low-quality results. File path terms in the query boost results from matching paths.

#### Scenario: Effective semantic query
- **WHEN** a developer searches `rag.search("how does tenant isolation work?")`
- **THEN** results from middleware, schema, and router files related to tenant filtering are returned as top results

#### Scenario: Overly vague query produces low-quality results
- **WHEN** a developer searches `rag.search("function")`
- **THEN** results are not useful — the developer MUST refine the query with domain-specific terms before acting on results

### Requirement: Prefer rag.search Before Reading Unknown Files
When the exact file path for a concept or pattern is not already known, `rag.search` SHALL be used before reaching for `Read` or `Bash` grep. Once the file path is known, `Read` is preferred over `rag.open` for full-file reads.

#### Scenario: Finding an implementation before editing
- **WHEN** a developer needs to add code following an existing pattern
- **THEN** `rag.search("pattern name")` is called first, results are opened with `rag.open`, and only then is the edit made

#### Scenario: Known path
- **WHEN** a developer already knows the exact file path (e.g. from a recent search or memory)
- **THEN** the `Read` tool is used directly without a RAG search round-trip
