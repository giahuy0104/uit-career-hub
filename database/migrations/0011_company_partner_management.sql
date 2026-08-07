ALTER TABLE companies
    ADD COLUMN tax_code text,
    ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);

ALTER TABLE companies
    ADD CONSTRAINT ck_companies_tax_code_trimmed
    CHECK (tax_code IS NULL OR (tax_code = btrim(tax_code) AND length(tax_code) BETWEEN 3 AND 50));

CREATE UNIQUE INDEX uq_companies_tax_code_normalized
    ON companies (lower(tax_code))
    WHERE tax_code IS NOT NULL;

CREATE INDEX idx_companies_partner_management
    ON companies (partner_status, updated_at DESC);

ALTER TABLE users
    ADD COLUMN suspension_reason text
        CHECK (suspension_reason IS NULL OR suspension_reason IN ('COMPANY_SUSPENDED', 'ADMIN_SUSPENDED'));
