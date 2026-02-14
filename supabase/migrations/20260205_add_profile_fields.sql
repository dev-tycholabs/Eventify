-- Add name and contact_number fields to users table for profile page
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_number TEXT;

-- Add unique constraint on username (if not already unique)
-- Note: username already exists but may not have unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE username IS NOT NULL;
