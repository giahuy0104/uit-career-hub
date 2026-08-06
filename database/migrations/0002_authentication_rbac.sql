ALTER TABLE users
    ADD COLUMN failed_login_attempts integer NOT NULL DEFAULT 0
        CHECK (failed_login_attempts >= 0),
    ADD COLUMN locked_until timestamptz,
    ADD COLUMN password_changed_at timestamptz;

CREATE TABLE refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id uuid NOT NULL,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    replaced_by_token_id uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    created_ip inet,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_refresh_tokens_active_user
    ON refresh_tokens (user_id, expires_at DESC)
    WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);

CREATE TABLE account_activation_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_type text NOT NULL CHECK (token_type IN ('COMPANY_ACTIVATION')),
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX uq_account_activation_tokens_active_company
    ON account_activation_tokens (user_id, token_type)
    WHERE used_at IS NULL;

CREATE INDEX idx_account_activation_tokens_expiry
    ON account_activation_tokens (expires_at)
    WHERE used_at IS NULL;
