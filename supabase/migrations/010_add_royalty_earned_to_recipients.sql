-- Add royalty_earned column to royalty_recipients table
-- Tracks cumulative royalties earned (in wei) from marketplace resales
ALTER TABLE royalty_recipients ADD COLUMN royalty_earned TEXT DEFAULT '0';

COMMENT ON COLUMN royalty_recipients.royalty_earned IS 'Cumulative royalties earned in wei from marketplace resales, calculated as: salePrice * (eventRoyaltyPercent/10000) * (recipientShare/10000)';
