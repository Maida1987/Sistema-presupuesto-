export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface JwtRefreshPayload {
  sub: string;
}
