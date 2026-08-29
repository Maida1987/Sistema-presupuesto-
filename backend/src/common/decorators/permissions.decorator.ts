import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Marca un endpoint con los permisos requeridos (RBAC). Evaluados por
 * PermissionsGuard contra los permisos efectivos del usuario autenticado
 * (unión de los permisos de todos sus roles).
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
