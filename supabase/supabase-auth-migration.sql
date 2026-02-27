-- Auth Nonces table (for SIWE sign-in flow)
CREATE TABLE IF NOT EXISTS auth_nonces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    nonce TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_nonces_wallet ON auth_nonces(wallet_address);
CREATE INDEX idx_auth_nonces_expires ON auth_nonces(expires_at);

-- Refresh Tokens table (for JWT token rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    token_family TEXT NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_wallet ON refresh_tokens(wallet_address);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(token_family);

-- Cleanup: auto-delete expired nonces (run periodically or use pg_cron)
-- DELETE FROM auth_nonces WHERE expires_at < NOW();

-- Cleanup: auto-delete expired/revoked refresh tokens
-- DELETE FROM refresh_tokens WHERE expires_at < NOW() OR is_revoked = TRUE;
