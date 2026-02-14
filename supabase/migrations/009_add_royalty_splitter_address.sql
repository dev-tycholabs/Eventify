-- Add royalty_splitter_address column to events table
-- Stores the on-chain RoyaltySplitter clone address deployed by EventFactory
ALTER TABLE events ADD COLUMN royalty_splitter_address TEXT;

COMMENT ON COLUMN events.royalty_splitter_address IS 'Address of the RoyaltySplitter clone contract deployed by EventFactory for this event';
