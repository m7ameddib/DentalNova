export interface JwtPayload {
  sub: number;
  username: string;
  roleName: string;
  /** Platform admin session — not a clinic database user. */
  dibnovaAdmin?: boolean;
  /** Online clinic installation this session belongs to. */
  installationId?: string;
}

export interface PasswordResetJwtPayload {
  sub: number;
  username: string;
  purpose: 'password_reset';
}

export interface AuthenticatedUser {
  id: number;
  fullName: string;
  username: string;
  isActive: boolean;
  roleId: number;
  roleName: string;
  roleLabel: string;
  permissions: string[];
}
