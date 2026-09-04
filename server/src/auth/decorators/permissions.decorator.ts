import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from '../../common/rbac.constants';

export const PERMISSIONS_KEY = 'permissions';

/** Marks a controller/route as requiring one or more permissions (ANY match). */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
