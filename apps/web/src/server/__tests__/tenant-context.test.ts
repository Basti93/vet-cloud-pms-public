import { describe, it, expect, vi } from "vitest";
import { withTenantContext } from "@/server/tenant-context";
import type { Database } from "@/lib/db/client";

// Build a minimal DB mock that captures what withTenantContext does to it.
function makeDbMock() {
  const executeMock = vi.fn().mockResolvedValue(undefined);
  const txMock = { execute: executeMock } as unknown as Database;
  const transactionMock = vi.fn().mockImplementation(
    async (cb: (tx: Database) => Promise<unknown>) => cb(txMock)
  );
  const dbMock = { transaction: transactionMock } as unknown as Database;
  return { dbMock, txMock, transactionMock, executeMock };
}

describe("withTenantContext", () => {
  it("opens a transaction and sets app.current_tenant_id", async () => {
    const { dbMock, transactionMock, executeMock } = makeDbMock();

    await withTenantContext(dbMock, "tenant-abc", async () => "ok");

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(executeMock).toHaveBeenCalledOnce();

    // The SQL object passed to execute must contain the tenant ID as a parameter
    const sqlArg = executeMock.mock.calls[0][0];
    expect(JSON.stringify(sqlArg)).toContain("tenant-abc");
  });

  it("passes tx (not the original db) into the callback", async () => {
    const { dbMock, txMock } = makeDbMock();

    let received: unknown;
    await withTenantContext(dbMock, "tenant-xyz", async (tx) => {
      received = tx;
      return null;
    });

    expect(received).toBe(txMock);
  });

  it("propagates the callback return value", async () => {
    const { dbMock } = makeDbMock();

    const result = await withTenantContext(dbMock, "t-1", async () => ({ rows: 42 }));
    expect(result).toEqual({ rows: 42 });
  });

  it("propagates errors from the callback (triggering transaction rollback)", async () => {
    const { dbMock } = makeDbMock();

    await expect(
      withTenantContext(dbMock, "t-1", async () => {
        throw new Error("procedure failed");
      })
    ).rejects.toThrow("procedure failed");
  });

  it("sets tenant_id before calling the callback", async () => {
    const { dbMock, executeMock } = makeDbMock();

    const callOrder: string[] = [];
    executeMock.mockImplementation(async () => {
      callOrder.push("set_config");
    });

    await withTenantContext(dbMock, "t-1", async () => {
      callOrder.push("callback");
      return null;
    });

    expect(callOrder).toEqual(["set_config", "callback"]);
  });

  it("uses set_config with true (transaction-local scope)", async () => {
    const { dbMock, executeMock } = makeDbMock();

    await withTenantContext(dbMock, "tenant-scoped", async () => null);

    const sqlArg = executeMock.mock.calls[0][0];
    const serialized = JSON.stringify(sqlArg);
    // set_config 3rd arg 'true' makes it transaction-local (SET LOCAL equivalent)
    expect(serialized).toContain("set_config");
    expect(serialized).toContain("true");
  });
});

describe("withTenantContext — isolation between calls", () => {
  it("each call gets its own transaction with the correct tenant ID", async () => {
    const executeCalls: string[] = [];

    function makeIsolatedDb(tenantLabel: string) {
      const executeMock = vi.fn().mockImplementation(async (sqlObj: unknown) => {
        const s = JSON.stringify(sqlObj);
        if (s.includes(tenantLabel)) executeCalls.push(tenantLabel);
      });
      const txMock = { execute: executeMock } as unknown as Database;
      return {
        transaction: vi.fn().mockImplementation(async (cb: (tx: Database) => Promise<unknown>) => cb(txMock)),
      } as unknown as Database;
    }

    const dbA = makeIsolatedDb("tenant-A");
    const dbB = makeIsolatedDb("tenant-B");

    await Promise.all([
      withTenantContext(dbA, "tenant-A", async () => null),
      withTenantContext(dbB, "tenant-B", async () => null),
    ]);

    expect(executeCalls).toContain("tenant-A");
    expect(executeCalls).toContain("tenant-B");
  });
});
