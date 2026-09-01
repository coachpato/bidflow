-- Bid360 uses server-side Prisma routes for database access. Public schema
-- tables should not be directly reachable through Supabase PostgREST roles.
DO $$
DECLARE
  table_record record;
  api_roles text;
BEGIN
  SELECT string_agg(quote_ident(rolname), ', ' ORDER BY rolname)
    INTO api_roles
  FROM pg_roles
  WHERE rolname IN ('anon', 'authenticated');

  FOR table_record IN
    SELECT quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS qualified_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_record.qualified_name);

    IF api_roles IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM %s', table_record.qualified_name, api_roles);
    END IF;
  END LOOP;

  IF api_roles IS NOT NULL THEN
    EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %s', api_roles);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM %s', api_roles);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM %s', api_roles);
  END IF;
END
$$;

-- Supabase projects can also have public default grants owned by
-- supabase_admin. Revoke them when the migration role is allowed to do so.
DO $$
DECLARE
  api_roles text;
BEGIN
  SELECT string_agg(quote_ident(rolname), ', ' ORDER BY rolname)
    INTO api_roles
  FROM pg_roles
  WHERE rolname IN ('anon', 'authenticated');

  IF api_roles IS NULL OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    RETURN;
  END IF;

  BEGIN
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM %s', api_roles);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM %s', api_roles);
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping supabase_admin default privilege changes: insufficient privilege';
  END;
END
$$;
