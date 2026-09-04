import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { Permission, Role } from '../../common/types';

@Injectable()
export class RolesRepository {
  constructor(private readonly db: DatabaseService) {}

  findAll(): Role[] {
    const rows = this.db.connection.prepare('SELECT * FROM roles ORDER BY id').all() as Record<
      string,
      unknown
    >[];
    return toCamelList<Role>(rows);
  }

  findByName(name: string): Role | undefined {
    const row = this.db.connection.prepare('SELECT * FROM roles WHERE name = ?').get(name) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<Role>(row) : undefined;
  }

  findById(id: number): Role | undefined {
    const row = this.db.connection.prepare('SELECT * FROM roles WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<Role>(row) : undefined;
  }

  getPermissionsForRole(roleId: number): Permission[] {
    const rows = this.db.connection
      .prepare(
        `SELECT p.* FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = ?
         ORDER BY p.key`,
      )
      .all(roleId) as Record<string, unknown>[];
    return toCamelList<Permission>(rows);
  }

  findAllPermissions(): Permission[] {
    const rows = this.db.connection.prepare('SELECT * FROM permissions ORDER BY key').all() as Record<
      string,
      unknown
    >[];
    return toCamelList<Permission>(rows);
  }
}
