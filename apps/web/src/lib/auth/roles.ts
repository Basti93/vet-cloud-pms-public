import { PERMISSIONS } from "@/lib/db/schema";

// Bump this when canonical system-role defaults change in code.
export const SYSTEM_ROLES_VERSION = 1;

export const ROLE_NAMES = {
  ADMIN: "Admin",
  VET: "Vet",
  RECEPTIONIST: "Receptionist",
} as const;

export const ROLE_CODES = {
  ADMIN: "admin",
  VET: "vet",
  RECEPTIONIST: "reception",
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];
export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const INVITE_ROLE_TO_CODE: Record<"admin" | "vet" | "reception", RoleCode> = {
  admin: ROLE_CODES.ADMIN,
  vet: ROLE_CODES.VET,
  reception: ROLE_CODES.RECEPTIONIST,
};

export const DEFAULT_ROLE_DEFINITIONS = [
  {
    code: ROLE_CODES.ADMIN,
    name: ROLE_NAMES.ADMIN,
    baseVersion: SYSTEM_ROLES_VERSION,
    description: "Full access",
    permissions: Object.values(PERMISSIONS),
    isSystem: true,
  },
  {
    code: ROLE_CODES.VET,
    name: ROLE_NAMES.VET,
    baseVersion: SYSTEM_ROLES_VERSION,
    description: "Medical access + appointments + patients + schedule management",
    permissions: [
      PERMISSIONS.MEDICAL_READ,
      PERMISSIONS.MEDICAL_CREATE,
      PERMISSIONS.MEDICAL_UPDATE,
      PERMISSIONS.APPOINTMENTS_READ,
      PERMISSIONS.APPOINTMENTS_UPDATE,
      PERMISSIONS.PATIENTS_READ,
      PERMISSIONS.PATIENTS_CREATE,
      PERMISSIONS.PATIENTS_UPDATE,
      PERMISSIONS.SCHEDULE_MANAGE,
    ],
    isSystem: true,
  },
  {
    code: ROLE_CODES.RECEPTIONIST,
    name: ROLE_NAMES.RECEPTIONIST,
    baseVersion: SYSTEM_ROLES_VERSION,
    description: "Appointments + patient data",
    permissions: [
      PERMISSIONS.APPOINTMENTS_READ,
      PERMISSIONS.APPOINTMENTS_CREATE,
      PERMISSIONS.APPOINTMENTS_CANCEL,
      PERMISSIONS.PATIENTS_READ,
      PERMISSIONS.PATIENTS_CREATE,
      PERMISSIONS.PATIENTS_UPDATE,
    ],
    isSystem: true,
  },
] as const;
