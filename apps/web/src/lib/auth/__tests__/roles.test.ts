import { describe, it, expect } from "vitest";
import { DEFAULT_ROLE_DEFINITIONS, ROLE_CODES } from "@/lib/auth/roles";
import { PERMISSIONS } from "@/lib/db/schema";

// Pure data test — no DB, no network.
// Guards against accidental permission changes that would be security regressions.

const ALL_PERMISSIONS = new Set(Object.values(PERMISSIONS));

describe("DEFAULT_ROLE_DEFINITIONS", () => {
  it("every permission string in every role exists in PERMISSIONS", () => {
    // Catches typos and stale permission strings that no longer exist.
    for (const role of DEFAULT_ROLE_DEFINITIONS) {
      for (const perm of role.permissions) {
        expect(
          ALL_PERMISSIONS.has(perm),
          `Role "${role.code}" references unknown permission "${perm}"`
        ).toBe(true);
      }
    }
  });

  it("admin has all permissions", () => {
    // Admin must always have the full permission set.
    // If a new permission is added to PERMISSIONS but forgotten in admin role, this fails.
    const admin = DEFAULT_ROLE_DEFINITIONS.find(
      (r) => r.code === ROLE_CODES.ADMIN
    )!;
    const adminPerms = new Set(admin.permissions);

    for (const perm of ALL_PERMISSIONS) {
      expect(
        adminPerms.has(perm),
        `Admin role is missing permission "${perm}" — add it to DEFAULT_ROLE_DEFINITIONS or remove from PERMISSIONS`
      ).toBe(true);
    }
  });

  it("vet cannot manage users, roles, or settings", () => {
    // Vets are clinical staff — they must never get admin capabilities.
    const vet = DEFAULT_ROLE_DEFINITIONS.find(
      (r) => r.code === ROLE_CODES.VET
    )!;
    // Widen to Set<string> — the tuple literal type would reject any perm not
    // already in the vet role, making "has(X)" a compile error for absent perms.
    const vetPerms = new Set<string>(vet.permissions);

    expect(vetPerms.has(PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(vetPerms.has(PERMISSIONS.ROLES_MANAGE)).toBe(false);
    expect(vetPerms.has(PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
  });

  it("receptionist cannot read or write medical records", () => {
    // Medical records are sensitive — reception staff must not access them.
    const reception = DEFAULT_ROLE_DEFINITIONS.find(
      (r) => r.code === ROLE_CODES.RECEPTIONIST
    )!;
    const receptionPerms = new Set<string>(reception.permissions);

    expect(receptionPerms.has(PERMISSIONS.MEDICAL_READ)).toBe(false);
    expect(receptionPerms.has(PERMISSIONS.MEDICAL_CREATE)).toBe(false);
    expect(receptionPerms.has(PERMISSIONS.MEDICAL_UPDATE)).toBe(false);
  });

  it("receptionist cannot manage users, roles, or settings", () => {
    const reception = DEFAULT_ROLE_DEFINITIONS.find(
      (r) => r.code === ROLE_CODES.RECEPTIONIST
    )!;
    const receptionPerms = new Set<string>(reception.permissions);

    expect(receptionPerms.has(PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(receptionPerms.has(PERMISSIONS.ROLES_MANAGE)).toBe(false);
    expect(receptionPerms.has(PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
  });
});
