import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ClinicExpensesRepository } from '../database/repositories/clinic-expenses.repository';
import { ExpenseCategoriesRepository } from '../database/repositories/expense-categories.repository';

@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService, ClinicExpensesRepository, ExpenseCategoriesRepository],
})
export class ExpensesModule {}
