-- =====================================================
-- Eventify - Full Database Setup Script
-- Run this in Supabase SQL Editor on a FRESH database
-- Consolidates: schema.sql + add_location_columns.sql
--   + all migrations (001-011, 20260205)
-- =====================================================

-- =====================================================
-- 1. EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 2. ENUMS
-- =====================================================
CREATE TYPE event_type AS ENUM ('online', 'offline');
CREATE TYPE event_status AS ENUM ('draft', 'published');
CREATE TYPE listing_status AS ENUM ('active', 'sold', 'cancelled');
CREATE TYPE transaction_type AS ENUM ('purchase', 'sale', 'listing', 'transfer', 'cancel', 'use');

-- =====================================================
-- 3. TABLES
-- =====================================================

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

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL,
    contract_address TEXT,
    organizer_address TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT,
    description TEXT,
    date TIMESTAMPTZ,
    timezone TEXT DEFAULT 'GMT',
    event_type event_type DEFAULT 'offline',
    venue TEXT,
    country TEXT,
    state TEXT,
    city TEXT,
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

COMMENT ON COLUMN events.chain_id IS 'EVM chain ID where this event contract is deployed (e.g. 127823 = Etherlink Shadownet, 11155111 = Sepolia)';
COMMENT ON COLUMN events.cover_image_url IS 'Wide banner image displayed at the top of the event page';
COMMENT ON COLUMN events.royalty_splitter_address IS 'Address of the RoyaltySplitter clone contract deployed by EventFactory for this event';
COMMENT ON COLUMN events.media_files IS 'Array of additional media files: [{url: string, type: "image"|"video"}]';

-- Marketplace Listings table
CREATE TABLE marketplace_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL,
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
    UNIQUE(chain_id, listing_id)
);

-- User Tickets table
CREATE TABLE user_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL,
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
    UNIQUE(chain_id, event_contract_address, token_id)
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL,
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
    UNIQUE(chain_id, tx_hash, tx_type, user_address)
);

-- Royalty Recipients table
CREATE TABLE royalty_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    recipient_address TEXT NOT NULL,
    recipient_name TEXT,
    percentage DECIMAL(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    royalty_earned TEXT DEFAULT '0',
    royalty_claimed TEXT DEFAULT '0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE royalty_recipients IS 'Stores multiple royalty recipients for events. Percentages should sum to 100 for each event.';
COMMENT ON COLUMN royalty_recipients.royalty_earned IS 'Cumulative royalties earned in wei from marketplace resales';
COMMENT ON COLUMN royalty_recipients.royalty_claimed IS 'Cumulative royalties actually claimed/distributed on-chain via the splitter contract, in wei. Synced from RoyaltySplitter.released(address).';

-- Royalty Distributions table (immutable audit trail)
CREATE TABLE royalty_distributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    splitter_address TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('claim_and_distribute', 'distribute', 'direct_claim')),
    total_distributed TEXT NOT NULL,
    triggered_by TEXT NOT NULL,
    recipients JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE royalty_distributions IS 'Immutable audit log of royalty claim/distribute transactions. Each row records a single on-chain distribution event with per-recipient breakdown.';
COMMENT ON COLUMN royalty_distributions.recipients IS 'JSON array of {address, percentage, amount_distributed} for each recipient in this distribution';
COMMENT ON COLUMN royalty_distributions.total_distributed IS 'Total wei distributed in this transaction';
COMMENT ON COLUMN royalty_distributions.triggered_by IS 'Wallet address that triggered the distribution';

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_address TEXT NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages table (token-gated event chat rooms)
CREATE TABLE chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_address TEXT NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    edited_at TIMESTAMPTZ DEFAULT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    deleted_for TEXT[] DEFAULT '{}'
);

-- =====================================================
-- 4. INDEXES
-- =====================================================

-- Users
CREATE INDEX idx_users_wallet ON users(wallet_address);

-- Events
CREATE INDEX idx_events_organizer ON events(organizer_address);
CREATE INDEX idx_events_contract ON events(contract_address);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_sold_count ON events(sold_count DESC);
CREATE INDEX idx_events_chain ON events(chain_id);
CREATE INDEX idx_events_chain_contract ON events(chain_id, contract_address);
CREATE INDEX idx_events_chain_organizer ON events(chain_id, organizer_address);

-- Marketplace Listings
CREATE INDEX idx_marketplace_listings_seller ON marketplace_listings(seller_address);
CREATE INDEX idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_listings_event ON marketplace_listings(event_contract_address);
CREATE INDEX idx_marketplace_listings_listing_id ON marketplace_listings(listing_id);
CREATE INDEX idx_marketplace_listings_chain ON marketplace_listings(chain_id);
CREATE INDEX idx_marketplace_listings_chain_status ON marketplace_listings(chain_id, status);

-- User Tickets
CREATE INDEX idx_user_tickets_owner ON user_tickets(owner_address);
CREATE INDEX idx_user_tickets_event ON user_tickets(event_contract_address);
CREATE INDEX idx_user_tickets_token ON user_tickets(token_id);
CREATE INDEX idx_user_tickets_is_used ON user_tickets(is_used);
CREATE INDEX idx_user_tickets_used_at ON user_tickets(used_at) WHERE used_at IS NOT NULL;
CREATE INDEX idx_user_tickets_chain ON user_tickets(chain_id);
CREATE INDEX idx_user_tickets_chain_owner ON user_tickets(chain_id, owner_address);

-- Transactions
CREATE INDEX idx_transactions_user ON transactions(user_address);
CREATE INDEX idx_transactions_type ON transactions(tx_type);
CREATE INDEX idx_transactions_event ON transactions(event_contract_address);
CREATE INDEX idx_transactions_timestamp ON transactions(tx_timestamp DESC);
CREATE INDEX idx_transactions_chain ON transactions(chain_id);
CREATE INDEX idx_transactions_chain_user ON transactions(chain_id, user_address);

-- Royalty Recipients
CREATE INDEX idx_royalty_recipients_event ON royalty_recipients(event_id);
CREATE INDEX idx_royalty_recipients_address ON royalty_recipients(recipient_address);

-- Royalty Distributions
CREATE INDEX idx_royalty_distributions_event ON royalty_distributions(event_id);
CREATE INDEX idx_royalty_distributions_splitter ON royalty_distributions(splitter_address);
CREATE INDEX idx_royalty_distributions_tx ON royalty_distributions(tx_hash);
CREATE INDEX idx_royalty_distributions_chain ON royalty_distributions(chain_id);

-- Comments
CREATE INDEX idx_comments_event ON comments(event_id);
CREATE INDEX idx_comments_user ON comments(user_address);
CREATE INDEX idx_comments_created ON comments(created_at DESC);

-- Chat Messages
CREATE INDEX idx_chat_messages_event_created ON chat_messages(event_id, created_at DESC);
CREATE INDEX idx_chat_messages_user_created ON chat_messages(user_address, created_at DESC);
CREATE INDEX idx_chat_messages_reply_to ON chat_messages(reply_to) WHERE reply_to IS NOT NULL;

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalty_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE royalty_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "Users are viewable by everyone"
    ON users FOR SELECT USING (true);

-- Events
CREATE POLICY "Published events are viewable by everyone"
    ON events FOR SELECT USING (status = 'published');

CREATE POLICY "Organizers can view their own events"
    ON events FOR SELECT USING (true);

CREATE POLICY "Organizers can insert events"
    ON events FOR INSERT WITH CHECK (true);

CREATE POLICY "Organizers can update their own events"
    ON events FOR UPDATE USING (true);

CREATE POLICY "Organizers can delete their own drafts"
    ON events FOR DELETE USING (status = 'draft');

-- Marketplace Listings
CREATE POLICY "Active listings are viewable by everyone"
    ON marketplace_listings FOR SELECT USING (true);

CREATE POLICY "Sellers can insert listings"
    ON marketplace_listings FOR INSERT WITH CHECK (true);

CREATE POLICY "Listings can be updated"
    ON marketplace_listings FOR UPDATE USING (true);

-- User Tickets
CREATE POLICY "Tickets are viewable by everyone"
    ON user_tickets FOR SELECT USING (true);

CREATE POLICY "Tickets can be inserted"
    ON user_tickets FOR INSERT WITH CHECK (true);

CREATE POLICY "Tickets can be updated"
    ON user_tickets FOR UPDATE USING (true);

-- Transactions
CREATE POLICY "Transactions are viewable by everyone"
    ON transactions FOR SELECT USING (true);

CREATE POLICY "Transactions can be inserted"
    ON transactions FOR INSERT WITH CHECK (true);

-- Royalty Recipients
CREATE POLICY "Royalty recipients are viewable by everyone"
    ON royalty_recipients FOR SELECT USING (true);

CREATE POLICY "Royalty recipients can be inserted"
    ON royalty_recipients FOR INSERT WITH CHECK (true);

CREATE POLICY "Royalty recipients can be updated"
    ON royalty_recipients FOR UPDATE USING (true);

CREATE POLICY "Royalty recipients can be deleted"
    ON royalty_recipients FOR DELETE USING (true);

-- Royalty Distributions
CREATE POLICY "Royalty distributions are viewable by everyone"
    ON royalty_distributions FOR SELECT USING (true);

CREATE POLICY "Royalty distributions can be inserted"
    ON royalty_distributions FOR INSERT WITH CHECK (true);

-- Comments
CREATE POLICY "Comments are viewable by everyone"
    ON comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert comments"
    ON comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete their own comments"
    ON comments FOR DELETE USING (true);

-- Chat Messages
CREATE POLICY "Chat messages are viewable by everyone"
    ON chat_messages FOR SELECT USING (true);

CREATE POLICY "Chat messages can be inserted"
    ON chat_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Chat messages can be updated"
    ON chat_messages FOR UPDATE USING (true);

-- =====================================================
-- 6. FUNCTIONS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atomically increment sold_count for an event
CREATE OR REPLACE FUNCTION increment_sold_count(contract_addr TEXT, p_chain_id INTEGER)
RETURNS void AS $fn$
BEGIN
    UPDATE events
    SET sold_count = sold_count + 1
    WHERE contract_address = contract_addr
      AND chain_id = p_chain_id;
END;
$fn$ LANGUAGE plpgsql;

-- =====================================================
-- 7. TRIGGERS
-- =====================================================

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_listings_updated_at
    BEFORE UPDATE ON marketplace_listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tickets_updated_at
    BEFORE UPDATE ON user_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_royalty_recipients_updated_at
    BEFORE UPDATE ON royalty_recipients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. REALTIME
-- =====================================================

-- Enable realtime for chat_messages (used for token-gated event chat)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- =====================================================
-- Setup complete! All tables, indexes, RLS policies,
-- functions, triggers, and realtime are configured.
-- =====================================================
