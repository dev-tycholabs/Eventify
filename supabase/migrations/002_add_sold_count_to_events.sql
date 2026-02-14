-- Migration: Add sold_count column to events table
-- This denormalized column tracks the number of tickets sold for better query performance

-- Add sold_count column with default 0
ALTER TABLE events ADD COLUMN IF NOT EXISTS sold_count INTEGER DEFAULT 0;

-- Create index for sorting by popularity
CREATE INDEX IF NOT EXISTS idx_events_sold_count ON events(sold_count DESC);

-- Create RPC function to increment sold_count atomically
CREATE OR REPLACE FUNCTION increment_sold_count(contract_addr TEXT)
RETURNS void AS $$
BEGIN
    UPDATE events
    SET sold_count = sold_count + 1
    WHERE contract_address = contract_addr;
END;
$$ LANGUAGE plpgsql;

-- Optional: Backfill sold_count from existing user_tickets data
-- This updates sold_count for any events that already have tickets sold
UPDATE events e
SET sold_count = (
    SELECT COUNT(*)
    FROM user_tickets ut
    WHERE ut.event_contract_address = e.contract_address
)
WHERE e.contract_address IS NOT NULL;
