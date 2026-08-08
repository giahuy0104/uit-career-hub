import type { UserStatus } from "../auth/auth.types.js";

export const partnerStatuses = ["PENDING", "ACTIVE", "SUSPENDED", "ENDED"] as const;
export type PartnerStatus = (typeof partnerStatuses)[number];

export type CompanyFields = {
  code: string;
  name: string;
  legalName: string | null;
  taxCode: string | null;
  industry: string | null;
  companySize: string | null;
  description: string | null;
  website: string | null;
  address: string | null;
};

export type RecruiterDto = {
  userId: string;
  email: string;
  fullName: string;
  title: string | null;
  isPrimary: boolean;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
};

export type CompanyDto = CompanyFields & {
  id: string;
  partnerStatus: PartnerStatus;
  version: number;
  verifiedAt: string | null;
  recruiterCount: number;
  activeRecruiterCount: number;
  recruitingJobCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CompanyDetailDto = CompanyDto & { recruiters: RecruiterDto[] };

export type PartnerDirectoryDto = {
  id: string;
  code: string;
  name: string;
  industry: string | null;
  companySize: string | null;
  description: string | null;
  website: string | null;
  address: string | null;
  verifiedAt: string | null;
  recruitingJobCount: number;
};

export type CompanyCreateInput = CompanyFields & {
  primaryRecruiter: { email: string; fullName: string; title: string | null };
};

export type CompanyUpdateInput = CompanyFields & { expectedVersion: number };

export type CompanyProfileUpdateInput = Omit<CompanyFields, "code" | "legalName" | "taxCode"> & {
  expectedVersion: number;
};

export type RecruiterCreateInput = { email: string; fullName: string; title: string | null };

export type ActivationTokenDto = { token: string; expiresAt: string };
