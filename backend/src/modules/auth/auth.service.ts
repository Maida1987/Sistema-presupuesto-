import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthenticatedUser, JwtAccessPayload, JwtRefreshPayload } from './auth.types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.toAuthenticatedUser(user);
  }

  async login(email: string, password: string): Promise<TokenPair & { user: AuthenticatedUser }> {
    const user = await this.validateCredentials(email, password);
    return { ...(await this.signTokens(user)), user };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuario inválido');
    }

    return this.signTokens(this.toAuthenticatedUser(user));
  }

  private async signTokens(user: AuthenticatedUser): Promise<TokenPair> {
    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
    });

    // Simplificación intencional de Fase 0: el refresh token no se rota ni
    // se guarda en una lista de revocación (ver docs/02-arquitectura.md §3).
    // Se agrega antes de cerrar Fase 8 (hardening de seguridad).
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id } as JwtRefreshPayload,
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
      },
    );

    return { accessToken, refreshToken };
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    fullName: string;
    roles: { role: { name: string; permissions: { permission: { code: string } }[] } }[];
  }): AuthenticatedUser {
    const roles = user.roles.map((userRole) => userRole.role.name);
    const permissions = Array.from(
      new Set(
        user.roles.flatMap((userRole) =>
          userRole.role.permissions.map((rolePermission) => rolePermission.permission.code),
        ),
      ),
    );

    return { id: user.id, email: user.email, fullName: user.fullName, roles, permissions };
  }
}
