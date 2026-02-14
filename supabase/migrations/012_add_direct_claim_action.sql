-- Migration: Add 'direct_claim' to royalty_distributions action check constraint
-- This supports the case where the event organizer is the sole royalty recipient
-- and claims directly from the marketplace without a splitter contract.

ALTER TABLE royalty_distributions DROP CONSTRAINT royalty_distributions_action_check;
ALTER TABLE royalty_distributions ADD CONSTRAINT royalty_distributions_action_check
    CHECK (action IN ('claim_and_distribute', 'distribute', 'direct_claim'));
