import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Global module exposing the low-level DatabaseService (raw connection +
 * migrations). Repositories live in feature modules and inject this
 * service; they are the only consumers allowed to run SQL.
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
