-- Recreate the tenant_memberships role check to include accounts_manager.
-- The live DB was created before this role was added to schema.sql.
ALTER TABLE tenant_memberships DROP CONSTRAINT IF EXISTS tenant_memberships_role_check;
ALTER TABLE tenant_memberships ADD CONSTRAINT tenant_memberships_role_check
  CHECK (role IN ('super_admin', 'accounts_manager', 'recruiter', 'vendor_manager', 'vendor_user'));
