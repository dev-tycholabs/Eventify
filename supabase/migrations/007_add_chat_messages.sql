-- Chat messages for token-gated event chat rooms
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_address TEXT NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for paginated queries (cursor-based on created_at)
CREATE INDEX idx_chat_messages_event_created ON chat_messages(event_id, created_at DESC);

-- Index for rate-limit queries if needed server-side
CREATE INDEX idx_chat_messages_user_created ON chat_messages(user_address, created_at DESC);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
