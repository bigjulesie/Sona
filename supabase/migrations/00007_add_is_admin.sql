-- Add is_admin flag to profiles, separate from portrait access tier
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Carry forward: users currently on family tier were acting as admins
UPDATE profiles SET is_admin = TRUE WHERE access_tier = 'family';
