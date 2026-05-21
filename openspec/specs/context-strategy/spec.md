# Context Strategy

How AI agents and developers MUST orient themselves at the start of each working session on Vet Cloud PMS to avoid re-discovering constraints, patterns, and architectural decisions that are already documented.

## Requirements

### Requirement: Session Start Orientation
Every AI agent session SHALL begin by reading `.claude/CLAUDE.md` (quick reference and current status) and `docs/CODEBASE_ARCHITECTURE.md` (file locations). Skipping orientation and jumping directly to code changes is not permitted.

#### Scenario: New session begins
- **WHEN** a new Claude Code session starts on this project
- **THEN** `.claude/CLAUDE.md` is read first for current phase and status, followed by `docs/CODEBASE_ARCHITECTURE.md` for orientation, before any code is read or written

### Requirement: Persistent Memory Between Sessions
Claude Code SHALL persist key patterns, architectural insights, and recent work to `~/.claude/memory/claude-vet-cloud-pms.md` across sessions. This memory file MUST be read at the start of each session before exploring the codebase.

#### Scenario: Resuming after a gap
- **WHEN** a developer resumes work after ending a previous session
- **THEN** the memory file at `~/.claude/memory/claude-vet-cloud-pms.md` is consulted before asking the user to re-explain the project context

### Requirement: RAG Before Code Exploration
Before implementing any new feature or pattern, an AI agent SHALL search the codebase using `rag.search` to discover existing implementations of similar patterns. Duplicating or contradicting an existing pattern discovered by search is not permitted without explicit justification.

#### Scenario: Implementing a new router
- **WHEN** a developer adds a new tRPC router
- **THEN** `rag.search("tRPC router multi-tenancy pattern")` is called first to confirm the correct procedure type, tenant filter, and error handling pattern before writing any code

### Requirement: Non-Negotiable Constraints Retained in Memory
The following constraints MUST be retained and applied in every session without needing to re-read the source documentation: every query needs `tenant_id`, TypeScript strict mode with tRPC shared types, permissions checked via `ctx.session.hasPermission()` before mutations, no premature caching.

#### Scenario: Writing a new query
- **WHEN** an AI agent writes any database query
- **THEN** `tenant_id` filtering and `deletedAt` exclusion are applied automatically, without the user needing to remind the agent

#### Scenario: Writing a mutation
- **WHEN** an AI agent writes a tRPC mutation
- **THEN** the permission check comes before any DB write and `TRPCError` is used for all error paths — not `new Error()`

### Requirement: Commit Messages Preserve Architectural Reasoning
Commit messages SHALL explain why a change was made, not just what changed, so that future sessions can reconstruct decisions from git history alone.

#### Scenario: Architectural decision commit
- **WHEN** a developer commits a change that follows or establishes a pattern
- **THEN** the commit message references the pattern or constraint (e.g. "following tRPC middleware pattern" or "multi-tenant: add tenant_id filter to appointments query")

### Requirement: CLAUDE.md Updated When Status Changes
`.claude/CLAUDE.md` SHALL be updated when the current phase changes, a significant feature ships, or next steps shift. Stale status information that misrepresents the current project state MUST be corrected.

#### Scenario: Feature ships
- **WHEN** a feature is merged to `main`
- **THEN** the "What just shipped" and "What's next" sections in `CLAUDE.md` are updated to reflect the new state before closing the session
