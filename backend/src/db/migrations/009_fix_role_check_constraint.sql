-- Normalize any legacy role values before re-adding the constraint.
-- Rows with unrecognised roles are mapped to 'recruiter' (the default).
UPDATE tenant_memberships
SET role = 'recruiter'
WHERE role NOT IN ('super_admin', 'accounts_manager', 'recruiter', 'vendor_manager', 'vendor_user');

-- Recreate the check constraint to include accounts_manager.
ALTER TABLE tenant_memberships DROP CONSTRAINT IF EXISTS tenant_memberships_role_check;
ALTER TABLE tenant_memberships ADD CONSTRAINT tenant_memberships_role_check
  CHECK (role IN ('super_admin', 'accounts_manager', 'recruiter', 'vendor_manager', 'vendor_user'));
