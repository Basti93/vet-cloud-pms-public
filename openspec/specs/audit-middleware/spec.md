# Audit Middleware

`writeAuditLog()` is currently called manually in 68 places across 4+ router files.
DSGVO-mandatory audit logging is a voluntary afterthought — any new mutation that omits the
call silently skips the audit trail. A missed call is undetectable at runtime.

## Requirements

### Requirement: Audited mutations call writeAuditLog unconditionally
Any tRPC mutation that modifies domain data (patient records, medical data, appointments,
schedule, user permissions) SHALL guarantee audit log writes through the procedure definition,
not through ad-hoc calls inside the handler body.

#### Scenario: New mutation added — audit fires automatically
- **WHEN** a developer defines a new write procedure using `auditedMutation`
- **THEN** `writeAuditLog()` is called after the handler completes, even if the developer does
  not include an explicit `writeAuditLog` call in the handler body

#### Scenario: Audit write failure does not silently swallow the mutation result
- **WHEN** `writeAuditLog()` throws (e.g., DB connection error)
- **THEN** the error is surfaced — not silently swallowed — so the caller is aware

#### Scenario: Existing audit calls removed from handler bodies
- **WHEN** any tRPC handler in `medical.ts`, `schedule.ts`, `admin.ts` is read
- **THEN** there are no standalone `await writeAuditLog(ctx, { ... })` calls inside handler bodies

### Requirement: Audit metadata flows from procedure context, not caller
The `tenantId`, `dbUserId`, and `clerkUserId` fields in the audit envelope SHALL come from
`ctx` (already resolved by middleware) — callers MUST NOT pass these fields explicitly to
the audit call.

#### Scenario: Audit envelope actor fields
- **WHEN** an audit log row is written via the middleware
- **THEN** `changes.actor.clerkUserId === ctx.userId`
- **AND** `changes.actor.userId === ctx.dbUserId`
- **AND** `tenantId === ctx.tenantId`

## Proposed Interface

```typescript
// apps/web/src/server/trpc/audited-mutation.ts

export interface AuditConfig {
  /** Domain entity being mutated, e.g. "diagnosis", "appointment" */
  entity: string;
  /** Dot-namespaced event name, e.g. "diagnosis.created" */
  event: string;
  /** AuditAction from audit.ts taxonomy */
  action: AuditAction;
  /**
   * Extract the entity ID from the mutation result.
   * Called with the value returned by the handler.
   */
  entityId: (result: unknown) => string;
  /** Optional field-level diff extracted from result */
  changes?: (result: unknown) => Record<string, unknown>;
}

/**
 * Wraps a protectedProcedure mutation with automatic audit logging.
 * Usage:
 *   const create = auditedMutation({
 *     entity: "diagnosis",
 *     event: "diagnosis.created",
 *     action: "create",
 *     entityId: (r) => (r as { id: string }).id,
 *   });
 *
 *   diagnosisRouter = {
 *     create: create.input(DiagnosisInput).mutation(async ({ ctx, input }) => {
 *       // handler: no writeAuditLog call needed
 *       return db.insert(...)...
 *     }),
 *   }
 */
export function auditedMutation(config: AuditConfig): /* tRPC procedure builder */ unknown;
```

## Affected Files (68 call sites across)

| File | Call sites |
|------|-----------|
| `routers/medical.ts` | 6 |
| `routers/schedule.ts` | 7 |
| `routers/admin.ts` | 4 |
| `routers/patients.ts` | TBD (verify) |
| `routers/vaccinations.ts` | TBD (verify) |

Full list: `grep -rn "writeAuditLog" apps/web/src/server/routers/`

## Migration Pattern

```typescript
// before (in handler body)
create: protectedProcedure
  .input(DiagnosisInput)
  .mutation(async ({ ctx, input }) => {
    const [diagnosis] = await ctx.db.insert(diagnoses).values(input).returning();
    await writeAuditLog(ctx, {
      tenantId: input.tenantId,
      action: "create",
      entity: { type: "diagnosis", id: diagnosis.id },
      event: "diagnosis.created",
    });
    return diagnosis;
  })

// after (audit fires automatically via middleware)
const auditCreate = auditedMutation({
  entity: "diagnosis",
  event: "diagnosis.created",
  action: "create",
  entityId: (r) => (r as { id: string }).id,
});

create: auditCreate
  .input(DiagnosisInput)
  .mutation(async ({ ctx, input }) => {
    const [diagnosis] = await ctx.db.insert(diagnoses).values(input).returning();
    return diagnosis;  // no writeAuditLog here
  })
```

## Verification

```bash
rtk tsc
grep -rn "writeAuditLog" apps/web/src/server/routers/
# should return 0 matches (all calls moved into middleware)
```

## Effort / Risk
- Effort: ~3h (68 call sites, each needs entity/event config verified)
- Risk: **medium** — audit correctness is DSGVO-critical; run against staging before prod
- Strategy: migrate one router at a time, verify audit table entries after each batch
