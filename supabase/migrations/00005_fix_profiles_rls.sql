-- Fix: Allow service_role to manage profiles (needed for auth trigger + admin operations)
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read profiles"
  ON profiles FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can update profiles"
  ON profiles FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
