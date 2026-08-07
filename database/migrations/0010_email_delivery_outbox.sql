CREATE TABLE email_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid NOT NULL UNIQUE REFERENCES notifications(id) ON DELETE CASCADE,
    recipient_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    locked_at timestamptz,
    provider_message_id text,
    last_error text,
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_deliveries_dispatch
    ON email_deliveries (next_attempt_at, created_at, id)
    WHERE status IN ('PENDING', 'FAILED', 'PROCESSING');

CREATE OR REPLACE FUNCTION queue_email_delivery_from_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.type IN (
        'APPLICATION_SUBMITTED',
        'APPLICATION_RECEIVED',
        'DAILY_UIT_PENDING_APPLICATIONS',
        'DAILY_COMPANY_PENDING_APPLICATIONS'
    ) THEN
        INSERT INTO email_deliveries (notification_id, recipient_user_id)
        VALUES (NEW.id, NEW.recipient_user_id)
        ON CONFLICT (notification_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notifications_queue_email_delivery
AFTER INSERT ON notifications
FOR EACH ROW
EXECUTE FUNCTION queue_email_delivery_from_notification();
