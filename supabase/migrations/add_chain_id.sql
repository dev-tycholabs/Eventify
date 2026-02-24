-- =====================================================
-- Migration: Add multi-chain support (chain_id column)
-- Run this against an EXISTING database that was set up
-- with setup_full_schema.sql
-- =====================================================

-- =====================================================
-- 1. ADD chain_id COLUMNS
-- =====================================================

-- Events: every event lives on a specific chain
ALTER TABLE events
    ADD COLUMN chain_id INTEGER NOT NULL DEFAULT 127823;
    -- Default 127823 = Etherlink Shadownet (your original chain)
    -- Remove the DEFAULT after backfilling if you prefer explicit inserts

-- Marketplace Listings: listing_id is per-chain marketplace contract
ALTER TABLE marketplace_listings
    ADD COLUMN chain_id INTEGER NOT NULL DEFAULT 127823;

-- User Tickets: token ownership is chain-specific
ALTER TABLE user_tickets
    ADD COLUMN chain_id INTEGER NOT NULL DEFAULT 127823;

-- Transactions: tx_hash is only unique within a chain
ALTER TABLE transactions
    ADD COLUMN chain_id INTEGER NOT NULL DEFAULT 127823;

-- Royalty Distributions: tx_hash and splitter are chain-specific
ALTER TABLE royalty_distributions
    ADD COLUMN chain_id INTEGER NOT NULL DEFAULT 127823;

-- =====================================================
-- 2. FIX UNIQUE CONSTRAINTS
-- =====================================================

-- marketplace_listings: listing_id is unique per chain, not globally
ALTER TABLE marketplace_listings
    DROP CONSTRAINT marketplace_listings_listing_id_key;
ALTER TABLE marketplace_listings
    ADD CONSTRAINT marketplace_listings_chain_listing_id_unique
    UNIQUE (chain_id, listing_id);

-- user_tickets: token uniqueness is per chain
ALTER TABLE user_tickets
    DROP CONSTRAINT user_tickets_event_contract_address_token_id_key;
ALTER TABLE user_tickets
    ADD CONSTRAINT user_tickets_chain_contract_token_unique
    UNIQUE (chain_id, event_contract_address, token_id);

-- transactions: tx uniqueness is per chain
ALTER TABLE transactions
    DROP CONSTRAINT transactions_tx_hash_tx_type_user_address_key;
ALTER TABLE transactions
    ADD CONSTRAINT transactions_chain_tx_hash_type_user_unique
    UNIQUE (chain_id, tx_hash, tx_type, user_address);

-- =====================================================
-- 3. ADD INDEXES for chain_id filtering
-- =====================================================

-- Events
CREATE INDEX idx_events_chain ON events(chain_id);
CREATE INDEX idx_events_chain_contract ON events(chain_id, contract_address);
CREATE INDEX idx_events_chain_organizer ON events(chain_id, organizer_address);

-- Marketplace Listings
CREATE INDEX idx_marketplace_listings_chain ON marketplace_listings(chain_id);
CREATE INDEX idx_marketplace_listings_chain_status ON marketplace_listings(chain_id, status);

-- User Tickets
CREATE INDEX idx_user_tickets_chain ON user_tickets(chain_id);
CREATE INDEX idx_user_tickets_chain_owner ON user_tickets(chain_id, owner_address);

-- Transactions
CREATE INDEX idx_transactions_chain ON transactions(chain_id);
CREATE INDEX idx_transactions_chain_user ON transactions(chain_id, user_address);

-- Royalty Distributions
CREATE INDEX idx_royalty_distributions_chain ON royalty_distributions(chain_id);

-- =====================================================
-- 4. UPDATE increment_sold_count FUNCTION
--    Now requires chain_id to target the right event
-- =====================================================

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
-- 5. COMMENTS
-- =====================================================

COMMENT ON COLUMN events.chain_id IS 'EVM chain ID where this event contract is deployed (e.g. 127823 = Etherlink Shadownet, 11155111 = Sepolia)';
COMMENT ON COLUMN marketplace_listings.chain_id IS 'EVM chain ID of the marketplace contract for this listing';
COMMENT ON COLUMN user_tickets.chain_id IS 'EVM chain ID where this ticket NFT exists';
COMMENT ON COLUMN transactions.chain_id IS 'EVM chain ID where this transaction occurred';
COMMENT ON COLUMN royalty_distributions.chain_id IS 'EVM chain ID where this distribution transaction occurred';
