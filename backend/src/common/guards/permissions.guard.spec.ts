import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { AuthenticatedUser } from '../../modules/auth/auth.types';

function buildContext(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const user: AuthenticatedUser = {
    id: '1',
    email: 'v@example.com',
    fullName: 'Vendedor',
    roles: ['Vendedor'],
    permissions: ['customers.read'],
  };

  it('permite el acceso cuando el endpoint no declara permisos requeridos', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(buildContext(user))).toBe(true);
  });

  it('permite el acceso cuando el usuario tiene el permiso requerido', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['customers.read']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(buildContext(user))).toBe(true);
  });

  it('rechaza cuando al usuario le falta un permiso requerido', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['customers.write']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(buildContext(user))).toThrow(ForbiddenException);
  });

  it('rechaza cuando no hay usuario autenticado en el request', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['customers.read']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
});
