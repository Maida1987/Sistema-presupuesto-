import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedUser } from '../../modules/auth/auth.types';

/**
 * RBAC por permisos (no por rol): un endpoint declara qué permisos necesita
 * (@RequirePermissions) y este guard verifica que el usuario los tenga,
 * vía la unión de permisos de todos sus roles. Ampliable sin tocar código:
 * los roles/permisos son datos (ver docs/01-analisis-funcional.md §2).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const hasAll = required.every((permission) => user.permissions.includes(permission));
    if (!hasAll) {
      throw new ForbiddenException('No tiene permisos suficientes para esta operación');
    }

    return true;
  }
}
