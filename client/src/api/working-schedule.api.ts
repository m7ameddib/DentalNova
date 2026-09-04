import { apiClient } from './client';

export interface WorkingPeriod {
  startTime: string;
  endTime: string;
}

export interface WeeklyDaySchedule {
  dayOfWeek: number;
  isOpen: boolean;
  periods: WorkingPeriod[];
}

export interface ScheduleException {
  id: number;
  exceptionDate: string;
  isClosed: boolean;
  note: string | null;
  periods: WorkingPeriod[];
}

export const workingScheduleApi = {
  getWeekly: () => apiClient.get<WeeklyDaySchedule[]>('/settings/working-schedule/weekly').then((r) => r.data),
  saveWeekly: (days: WeeklyDaySchedule[]) =>
    apiClient.patch<WeeklyDaySchedule[]>('/settings/working-schedule/weekly', { days }).then((r) => r.data),
  listExceptions: () =>
    apiClient.get<ScheduleException[]>('/settings/working-schedule/exceptions').then((r) => r.data),
  createException: (payload: {
    exceptionDate: string;
    isClosed: boolean;
    note?: string;
    periods?: WorkingPeriod[];
  }) => apiClient.post<ScheduleException>('/settings/working-schedule/exceptions', payload).then((r) => r.data),
  updateException: (
    id: number,
    payload: { isClosed?: boolean; note?: string; periods?: WorkingPeriod[] },
  ) => apiClient.patch<ScheduleException>(`/settings/working-schedule/exceptions/${id}`, payload).then((r) => r.data),
  deleteException: (id: number) => apiClient.delete(`/settings/working-schedule/exceptions/${id}`).then((r) => r.data),
};
