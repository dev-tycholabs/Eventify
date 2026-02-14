-- Comments table for event pages
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_address TEXT NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_comments_event ON comments(event_id);
CREATE INDEX idx_comments_user ON comments(user_address);
CREATE INDEX idx_comments_created ON comments(created_at DESC);

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Comments are viewable by everyone"
    ON comments FOR SELECT
    USING (true);

CREATE POLICY "Authenticated users can insert comments"
    ON comments FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can delete their own comments"
    ON comments FOR DELETE
    USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
