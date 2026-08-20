export const userRoles = ["STUDENT", "UIT_ADMIN", "COMPANY"] as const;
export type UserRole = (typeof userRoles)[number];

export const userStatuses = ["PENDING_ACTIVATION", "ACTIVE", "SUSPENDED", "LOCKED"] as const;
export type UserStatus = (typeof userStatuses)[number];

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  displayName: string | null;
  organization: string | null;
  studentProfileId: string | null;
  companyId: string | null;
};

export type UserDto = Omit<
  AuthUser,
  "passwordHash" | "failedLoginAttempts" | "lockedUntil"
>;

export type AuthPrincipal = {
  userId: string;
  email: string;
  role: UserRole;
  tokenId: string;
  studentProfileId: string | null;
  companyId: string | null;
};

export type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

export function toUserDto(user: AuthUser): UserDto {
  const {
    passwordHash: _passwordHash,
    failedLoginAttempts: _failedLoginAttempts,
    lockedUntil: _lockedUntil,
    ...dto
  } = user;
  return dto;
}
