-- Add reply, edit, and delete support to chat_messages

-- reply_to: references another message this is a reply to
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL;

-- edited_at: timestamp when message was last edited (null = never edited)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

-- deleted_at: timestamp when message was deleted for everyone (null = not deleted)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- deleted_for: array of wallet addresses who deleted this message for themselves
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_for TEXT[] DEFAULT '{}';

-- Index for reply lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON chat_messages(reply_to) WHERE reply_to IS NOT NULL;
