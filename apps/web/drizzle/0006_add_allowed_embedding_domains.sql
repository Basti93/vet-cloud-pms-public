DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'allowed_embedding_domains') THEN
    ALTER TABLE "tenants" ADD COLUMN "allowed_embedding_domains" jsonb;
  END IF;
END $$;
