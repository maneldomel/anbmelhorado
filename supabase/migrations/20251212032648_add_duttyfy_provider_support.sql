/*
  # Add Duttyfy Provider Support

  1. Changes
    - Add 'duttyfy' to the allowed provider types in pix_provider_settings table
    - This enables Duttyfy as a payment provider option
  
  2. Security
    - No changes to RLS policies (existing policies remain in effect)
  
  3. Notes
    - Duttyfy uses encrypted key authentication in URL
    - API Base URL: https://app.duttyfy.com.br/api-pix/{encrypted_key}
    - Supports UTM parameters for campaign tracking
    - All amounts must be in cents (multiply by 100)
*/

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pix_provider_settings' 
    AND column_name = 'provider'
  ) THEN
    ALTER TABLE pix_provider_settings 
    DROP CONSTRAINT IF EXISTS pix_provider_settings_provider_check;
    
    ALTER TABLE pix_provider_settings
    ADD CONSTRAINT pix_provider_settings_provider_check 
    CHECK (provider IN ('mangofy', 'genesys', 'aureo', 'bestfy', 'babylon', 'ghostspays', 'paradisepays', 'duttyfy'));
  END IF;
END $$;
