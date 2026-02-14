-- Migration: Add 'use' transaction type for ticket usage tracking
-- This allows tracking when tickets are marked as used at events

-- Add 'use' to the transaction_type enum
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'use';

-- Add index for faster queries on used tickets
CREATE INDEX IF NOT EXISTS idx_user_tickets_is_used ON user_tickets(is_used);
CREATE INDEX IF NOT EXISTS idx_user_tickets_used_at ON user_tickets(used_at) WHERE used_at IS NOT NULL;
