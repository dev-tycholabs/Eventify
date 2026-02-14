-- Migration: Add cover_image_url and media_files columns to events table
-- These fields support the updated event creation form

-- Add cover_image_url column for banner/cover images
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Add media_files column for additional photos/videos (stored as JSONB array)
-- Each media file object contains: { url: string, type: 'image' | 'video' }
ALTER TABLE events ADD COLUMN IF NOT EXISTS media_files JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN events.cover_image_url IS 'Wide banner image displayed at the top of the event page';
COMMENT ON COLUMN events.media_files IS 'Array of additional media files: [{url: string, type: "image"|"video"}]';
