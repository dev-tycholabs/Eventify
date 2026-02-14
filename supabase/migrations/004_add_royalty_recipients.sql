-- Migration: Add royalty_recipients table
-- This table stores multiple royalty recipients for each event

-- Royalty Recipients table
CREATE TABLE royalty_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    recipient_address TEXT NOT NULL,
    recipient_name TEXT,
    percentage DECIMAL(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for royalty_recipients
CREATE INDEX idx_royalty_recipients_event ON royalty_recipients(event_id);
CREATE INDEX idx_royalty_recipients_address ON royalty_recipients(recipient_address);

-- Enable Row Level Security
ALTER TABLE royalty_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for royalty_recipients
CREATE POLICY "Royalty recipients are viewable by everyone"
    ON royalty_recipients FOR SELECT
    USING (true);

CREATE POLICY "Royalty recipients can be inserted"
    ON royalty_recipients FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Royalty recipients can be updated"
    ON royalty_recipients FOR UPDATE
    USING (true);

CREATE POLICY "Royalty recipients can be deleted"
    ON royalty_recipients FOR DELETE
    USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_royalty_recipients_updated_at
    BEFORE UPDATE ON royalty_recipients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE royalty_recipients IS 'Stores multiple royalty recipients for events. Percentages should sum to 100 for each event.';
