ALTER TABLE categories
    ADD COLUMN is_active boolean NOT NULL DEFAULT true,
    ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    ADD CONSTRAINT ck_categories_code_format
        CHECK (code = upper(code) AND code ~ '^[A-Z0-9_]+$' AND length(code) BETWEEN 2 AND 50),
    ADD CONSTRAINT ck_categories_name_trimmed
        CHECK (name = btrim(name) AND length(name) BETWEEN 2 AND 120);

ALTER TABLE skills
    ADD COLUMN is_active boolean NOT NULL DEFAULT true,
    ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    ADD CONSTRAINT ck_skills_slug_format
        CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 80),
    ADD CONSTRAINT ck_skills_name_trimmed
        CHECK (name = btrim(name) AND length(name) BETWEEN 2 AND 120);

CREATE UNIQUE INDEX uq_categories_name_normalized ON categories (lower(name));
CREATE UNIQUE INDEX uq_skills_name_normalized ON skills (lower(name));

CREATE INDEX idx_categories_admin_list ON categories (is_active, name, id);
CREATE INDEX idx_skills_admin_list ON skills (is_active, name, id);
