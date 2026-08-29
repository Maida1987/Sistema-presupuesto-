import * as argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('AuthService', () => {
  const password = 'ChangeMe123!';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash(password);
  });

  function buildUser(overrides: Partial<{ status: string }> = {}) {
    return {
      id: 'user-1',
      email: 'admin@example.com',
      fullName: 'Admin',
      passwordHash,
      status: overrides.status ?? 'ACTIVE',
      roles: [
        {
          role: {
            name: 'Administrador',
            permissions: [
              { permission: { code: 'customers.read' } },
              { permission: { code: 'customers.write' } },
              // permiso duplicado a propósito: dos roles podrían compartirlo
              { permission: { code: 'customers.read' } },
            ],
          },
        },
      ],
    };
  }

  function buildService(user: ReturnType<typeof buildUser> | null) {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
    } as unknown as PrismaService;

    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    } as unknown as JwtService;

    const configService = {
      get: jest.fn().mockReturnValue('irrelevant'),
    } as unknown as ConfigService;

    return new AuthService(prisma, jwtService, configService);
  }

  it('rechaza credenciales con contraseña incorrecta', async () => {
    const service = buildService(buildUser());
    await expect(service.validateCredentials('admin@example.com', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza usuarios inactivos aunque la contraseña sea correcta', async () => {
    const service = buildService(buildUser({ status: 'INACTIVE' }));
    await expect(service.validateCredentials('admin@example.com', password)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('acepta credenciales válidas y deduplica permisos entre roles', async () => {
    const service = buildService(buildUser());
    const user = await service.validateCredentials('admin@example.com', password);

    expect(user.roles).toEqual(['Administrador']);
    expect(user.permissions.sort()).toEqual(['customers.read', 'customers.write']);
  });

  it('rechaza si el usuario no existe', async () => {
    const service = buildService(null);
    await expect(service.validateCredentials('nadie@example.com', password)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
