export interface JwtPayload {
  sub: number;
  username: string;
  roleName: string;
  /** Platform admin session — not a clinic database user. */
  dibnovaAdmin?: boolean;
  /** Token purpose. Clinic sessions omit this; admin tokens must be `dibnova_admin`. */
  purpose?: string;
  /** Token type discriminator. */
  typ?: string;
  iss?: string;
  aud?: string | string[];
  jti?: string;
  /** Online clinic installation this session belongs to. */
  installationId?: string;
  /** Online clinic this session is bound to. Server-side tenant key. */
  clinicId?: string;
}

export interface AdminJwtPayload extends JwtPayload {
  dibnovaAdmin: true;
  purpose: 'dibnova_admin';
  typ: 'dibnova-admin';
  roleName: 'dibnova_admin';
}

export interface PasswordResetJwtPayload {
  sub: number;
  username: string;
  purpose: 'password_reset';
  clinicId?: string;
  /** SHA-256 prefix of the password hash at issue time — invalid after a successful reset. */
  passwordTag?: string;
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
