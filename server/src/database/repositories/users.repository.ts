import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { toCamel, toCamelList } from '../row-mapper.util';
import { User } from '../../common/types';

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DatabaseService) {}

  findByUsername(username: string): User | undefined {
    const row = this.db.connection
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as Record<string, unknown> | undefined;
    return row ? toCamel<User>(row) : undefined;
  }

  findById(id: number): User | undefined {
    const row = this.db.connection.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toCamel<User>(row) : undefined;
  }

  findAll(): User[] {
    const rows = this.db.connection
      .prepare('SELECT * FROM users ORDER BY full_name')
      .all() as Record<string, unknown>[];
    return toCamelList<User>(rows);
  }

  create(input: {
    fullName: string;
    username: string;
    passwordHash: string;
    roleId: number;
  }): User {
    const result = this.db.connection
      .prepare(
        `INSERT INTO users (full_name, username, password_hash, role_id) VALUES (?, ?, ?, ?)`,
      )
      .run(input.fullName, input.username, input.passwordHash, input.roleId);
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(
    id: number,
    input: { fullName?: string; roleId?: number; isActive?: boolean; passwordHash?: string },
  ): User | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...input };
    this.db.connection
      .prepare(
        `UPDATE users SET full_name = ?, role_id = ?, is_active = ?, password_hash = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(merged.fullName, merged.roleId, merged.isActive ? 1 : 0, merged.passwordHash, id);
    return this.findById(id);
  }
}
