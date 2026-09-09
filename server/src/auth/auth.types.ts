export interface JwtPayload {
  sub: number;
  username: string;
  roleName: string;
  /** Platform admin session — not a clinic database user. */
  dibnovaAdmin?: boolean;
  /** Online clinic installation this session belongs to. */
  installationId?: string;
  /** Online clinic this session is bound to. Server-side tenant key. */
  clinicId?: string;
}

export interface PasswordResetJwtPayload {
  sub: number;
  username: string;
  purpose: 'password_reset';
  clinicId?: string;
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
  clinicId?: string;
}
