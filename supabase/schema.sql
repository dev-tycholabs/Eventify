-- Supabase Schema for Eventify
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE event_type AS ENUM ('online', 'offline');
CREATE TYPE event_status AS ENUM ('draft', 'published');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT UNIQUE NOT NULL,
    username TEXT,
    name TEXT,
    email TEXT,
    contact_number TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index on username (only for non-null values)
CREATE UNIQUE INDEX idx_users_username_unique ON users(username) WHERE username IS NOT NULL;

-- Events table (includes drafts via status field)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address TEXT,
    organizer_address TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT,
    description TEXT,
    date TIMESTAMPTZ,
    timezone TEXT DEFAULT 'GMT',
    event_type event_type DEFAULT 'offline',
    venue TEXT,
    image_url TEXT,
    cover_image_url TEXT,
    media_files JSONB DEFAULT '[]'::jsonb,
    ticket_price TEXT,
    total_supply INTEGER,
    sold_count INTEGER DEFAULT 0,
    max_tickets_per_wallet INTEGER DEFAULT 5,
    max_resale_price TEXT,
    royalty_percent TEXT,
    royalty_splitter_address TEXT,
    status event_status DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments for documentation
COMMENT ON COLUMN events.cover_image_url IS 'Wide banner image displayed at the top of the event page';
COMMENT ON COLUMN events.media_files IS 'Array of additional media files: [{url: string, type: "image"|"video"}]';

-- Indexes for better query performance
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_events_organizer ON events(organizer_address);
CREATE INDEX idx_events_contract ON events(contract_address);
CREATE INDEX idx_events_status ON events(status);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users are viewable by everyone"
    ON users FOR SELECT
    USING (true);

-- RLS Policies for events table
-- Anyone can read published events
CREATE POLICY "Published events are viewable by everyone"
    ON events FOR SELECT
    USING (status = 'published');

-- Organizers can view their own events (including drafts)
CREATE POLICY "Organizers can view their own events"
    ON events FOR SELECT
    USING (true);  -- Allow all reads at RLS level, filter by organizer in application

-- Organizers can insert their own events
CREATE POLICY "Organizers can insert events"
    ON events FOR INSERT
    WITH CHECK (true);

-- Organizers can update their own events
CREATE POLICY "Organizers can update their own events"
    ON events FOR UPDATE
    USING (true);

-- Organizers can delete their own draft events
CREATE POLICY "Organizers can delete their own drafts"
    ON events FOR DELETE
    USING (status = 'draft');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MARKETPLACE, TICKETS, AND TRANSACTIONS TABLES
-- =====================================================

-- Create enums for new tables
CREATE TYPE listing_status AS ENUM ('active', 'sold', 'cancelled');
CREATE TYPE transaction_type AS ENUM ('purchase', 'sale', 'listing', 'transfer', 'cancel', 'use');

-- Marketplace Listings table
CREATE TABLE marketplace_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id TEXT NOT NULL,
    token_id TEXT NOT NULL,
    event_contract_address TEXT NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    seller_address TEXT NOT NULL,
    price TEXT NOT NULL,
    status listing_status DEFAULT 'active',
    buyer_address TEXT,
    listed_at TIMESTAMPTZ DEFAULT NOW(),
    sold_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(listing_id)
);

-- User Tickets table
CREATE TABLE user_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id TEXT NOT NULL,
    event_contract_address TEXT NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    owner_address TEXT NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    is_listed BOOLEAN DEFAULT FALSE,
    listing_id TEXT,
    purchase_price TEXT,
    purchase_tx_hash TEXT,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_contract_address, token_id)
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_hash TEXT NOT NULL,
    tx_type transaction_type NOT NULL,
    user_address TEXT NOT NULL,
    token_id TEXT,
    event_contract_address TEXT,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    listing_id TEXT,
    amount TEXT,
    from_address TEXT,
    to_address TEXT,
    block_number TEXT,
    tx_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tx_hash, tx_type, user_address)
);

-- Indexes for marketplace_listings
CREATE INDEX idx_marketplace_listings_seller ON marketplace_listings(seller_address);
CREATE INDEX idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_listings_event ON marketplace_listings(event_contract_address);
CREATE INDEX idx_marketplace_listings_listing_id ON marketplace_listings(listing_id);

-- Indexes for user_tickets
CREATE INDEX idx_user_tickets_owner ON user_tickets(owner_address);
CREATE INDEX idx_user_tickets_event ON user_tickets(event_contract_address);
CREATE INDEX idx_user_tickets_token ON user_tickets(token_id);
CREATE INDEX idx_user_tickets_is_used ON user_tickets(is_used);
CREATE INDEX idx_user_tickets_used_at ON user_tickets(used_at) WHERE used_at IS NOT NULL;

-- Indexes for transactions
CREATE INDEX idx_transactions_user ON transactions(user_address);
CREATE INDEX idx_transactions_type ON transactions(tx_type);
CREATE INDEX idx_transactions_event ON transactions(event_contract_address);
CREATE INDEX idx_transactions_timestamp ON transactions(tx_timestamp DESC);

-- Enable Row Level Security
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketplace_listings
CREATE POLICY "Active listings are viewable by everyone"
    ON marketplace_listings FOR SELECT
    USING (true);

CREATE POLICY "Sellers can insert listings"
    ON marketplace_listings FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Listings can be updated"
    ON marketplace_listings FOR UPDATE
    USING (true);

-- RLS Policies for user_tickets
CREATE POLICY "Tickets are viewable by everyone"
    ON user_tickets FOR SELECT
    USING (true);

CREATE POLICY "Tickets can be inserted"
    ON user_tickets FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Tickets can be updated"
    ON user_tickets FOR UPDATE
    USING (true);

-- RLS Policies for transactions
CREATE POLICY "Transactions are viewable by everyone"
    ON transactions FOR SELECT
    USING (true);

CREATE POLICY "Transactions can be inserted"
    ON transactions FOR INSERT
    WITH CHECK (true);

-- Triggers for updated_at on new tables
CREATE TRIGGER update_marketplace_listings_updated_at
    BEFORE UPDATE ON marketplace_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tickets_updated_at
    BEFORE UPDATE ON user_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- ROYALTY RECIPIENTS TABLE
-- =====================================================

-- Royalty Recipients table (for splitting royalties among multiple recipients)
CREATE TABLE royalty_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    recipient_address TEXT NOT NULL,
    recipient_name TEXT,
    percentage DECIMAL(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    royalty_earned TEXT DEFAULT '0',
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
