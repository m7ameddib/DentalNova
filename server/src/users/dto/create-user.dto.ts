import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  // Role is validated dynamically against the roles table (data-driven RBAC),
  // not restricted to a fixed enum, so new roles can be added without code changes.
  @IsString()
  @IsNotEmpty()
  roleName!: string;
}
