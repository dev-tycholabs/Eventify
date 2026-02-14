-- Migration: Add royalty_claimed to royalty_recipients and create royalty_distributions log table
-- royalty_earned = accrued from marketplace sales (incremented at sale time)
-- royalty_claimed = actually distributed/paid out on-chain via splitter contract

-- Add royalty_claimed column to track on-chain distributions separately from earnings
ALTER TABLE royalty_recipients ADD COLUMN royalty_claimed TEXT DEFAULT '0';

COMMENT ON COLUMN royalty_recipients.royalty_claimed IS 'Cumulative royalties actually claimed/distributed on-chain via the splitter contract, in wei. Synced from RoyaltySplitter.released(address).';

-- Royalty distributions log table — immutable audit trail of every claim/distribute action
CREATE TABLE royalty_distributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    splitter_address TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('claim_and_distribute', 'distribute')),
    total_distributed TEXT NOT NULL,
    triggered_by TEXT NOT NULL,
    recipients JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_royalty_distributions_event ON royalty_distributions(event_id);
CREATE INDEX idx_royalty_distributions_splitter ON royalty_distributions(splitter_address);
CREATE INDEX idx_royalty_distributions_tx ON royalty_distributions(tx_hash);

-- Enable RLS
ALTER TABLE royalty_distributions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Royalty distributions are viewable by everyone"
    ON royalty_distributions FOR SELECT
    USING (true);

CREATE POLICY "Royalty distributions can be inserted"
    ON royalty_distributions FOR INSERT
    WITH CHECK (true);

COMMENT ON TABLE royalty_distributions IS 'Immutable audit log of royalty claim/distribute transactions. Each row records a single on-chain distribution event with per-recipient breakdown.';
COMMENT ON COLUMN royalty_distributions.recipients IS 'JSON array of {address, percentage, amount_distributed} for each recipient in this distribution';
COMMENT ON COLUMN royalty_distributions.total_distributed IS 'Total wei distributed in this transaction';
COMMENT ON COLUMN royalty_distributions.triggered_by IS 'Wallet address that triggered the distribution';
