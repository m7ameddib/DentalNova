export interface JwtPayload {
  sub: number;
  username: string;
  roleName: string;
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
