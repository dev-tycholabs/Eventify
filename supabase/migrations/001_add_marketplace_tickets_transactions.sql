-- Migration: Add marketplace_listings, user_tickets, and transactions tables
-- Run this migration if you already have the base schema (users and events tables)

-- Create enums for new tables (if they don't exist)
DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('active', 'sold', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('purchase', 'sale', 'listing', 'transfer', 'cancel');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Marketplace Listings table
CREATE TABLE IF NOT EXISTS marketplace_listings (
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
CREATE TABLE IF NOT EXISTS user_tickets (
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
CREATE TABLE IF NOT EXISTS transactions (
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
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON marketplace_listings(seller_address);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_event ON marketplace_listings(event_contract_address);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_listing_id ON marketplace_listings(listing_id);

-- Indexes for user_tickets
CREATE INDEX IF NOT EXISTS idx_user_tickets_owner ON user_tickets(owner_address);
CREATE INDEX IF NOT EXISTS idx_user_tickets_event ON user_tickets(event_contract_address);
CREATE INDEX IF NOT EXISTS idx_user_tickets_token ON user_tickets(token_id);

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_transactions_event ON transactions(event_contract_address);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(tx_timestamp DESC);

-- Enable Row Level Security
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketplace_listings
DROP POLICY IF EXISTS "Active listings are viewable by everyone" ON marketplace_listings;
CREATE POLICY "Active listings are viewable by everyone"
    ON marketplace_listings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Sellers can insert listings" ON marketplace_listings;
CREATE POLICY "Sellers can insert listings"
    ON marketplace_listings FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Listings can be updated" ON marketplace_listings;
CREATE POLICY "Listings can be updated"
    ON marketplace_listings FOR UPDATE
    USING (true);

-- RLS Policies for user_tickets
DROP POLICY IF EXISTS "Tickets are viewable by everyone" ON user_tickets;
CREATE POLICY "Tickets are viewable by everyone"
    ON user_tickets FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Tickets can be inserted" ON user_tickets;
CREATE POLICY "Tickets can be inserted"
    ON user_tickets FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Tickets can be updated" ON user_tickets;
CREATE POLICY "Tickets can be updated"
    ON user_tickets FOR UPDATE
    USING (true);

-- RLS Policies for transactions
DROP POLICY IF EXISTS "Transactions are viewable by everyone" ON transactions;
CREATE POLICY "Transactions are viewable by everyone"
    ON transactions FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Transactions can be inserted" ON transactions;
CREATE POLICY "Transactions can be inserted"
    ON transactions FOR INSERT
    WITH CHECK (true);

-- Triggers for updated_at on new tables
DROP TRIGGER IF EXISTS update_marketplace_listings_updated_at ON marketplace_listings;
CREATE TRIGGER update_marketplace_listings_updated_at
    BEFORE UPDATE ON marketplace_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_tickets_updated_at ON user_tickets;
CREATE TRIGGER update_user_tickets_updated_at
    BEFORE UPDATE ON user_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
