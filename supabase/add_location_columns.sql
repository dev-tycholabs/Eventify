-- Add location columns to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS city text;
