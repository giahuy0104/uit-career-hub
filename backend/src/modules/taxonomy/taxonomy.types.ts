export const taxonomyStatuses = ["ACTIVE", "INACTIVE"] as const;
export type TaxonomyStatus = (typeof taxonomyStatuses)[number];

export type TaxonomyListInput = {
  page: number;
  pageSize: number;
  query?: string;
  status?: TaxonomyStatus;
};

type TaxonomyItem = {
  id: string;
  name: string;
  status: TaxonomyStatus;
  version: number;
  jobCount: number;
  openJobCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryDto = TaxonomyItem & { code: string };
export type SkillDto = TaxonomyItem & { slug: string };

export type CategoryCreateInput = { code: string; name: string };
export type SkillCreateInput = { slug: string; name: string };
export type TaxonomyUpdateInput = { name: string; expectedVersion: number };
export type TaxonomyStateInput = { expectedVersion: number; reason: string };

export type TaxonomyKind = "category" | "skill";
