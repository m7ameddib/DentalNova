import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MessageCircle, Plus, X } from 'lucide-react';
import { isAxiosError } from 'axios';
import { appointmentsApi, CreateAppointmentPayload, UpdateAppointmentPayload } from '@/api/appointments.api';
import { patientsApi } from '@/api/patients.api';
import { settingsApi } from '@/api/settings.api';
import { AppointmentsPrintView } from '@/components/appointments/AppointmentsPrintView';
import { AgendaSidebar } from '@/components/appointments/AgendaSidebar';
import { TodaysBriefPanel } from '@/components/appointments/TodaysBriefPanel';
import { fetchPatientPrintSummary } from '@/components/appointments/printHelpers';
import { WeekCalendar } from '@/components/appointments/WeekCalendar';
import {
  ALL_STATUS_OPTIONS,
  CalendarViewMode,
  DEFAULT_DURATION,
  DURATION_OPTIONS,
  EMERGENCY_TYPE,
  appointmentOverlaps,
  isEmergencyAppointment,
  ROW_HEIGHT_PX_15,
  ROW_HEIGHT_PX_30,
} from '@/components/appointments/constants';
import { MonthCalendar } from '@/components/appointments/MonthCalendar';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { usePrintStore } from '@/store/print.store';
import { useUiStore } from '@/store/ui.store';
import { loadClinicPrintInfo } from '@/utils/clinicPrintInfo';
import { formatDateDisplay, formatTimeDisplay, localAddDaysIso, todayIso } from '@/utils/date';
import { buildWeekDays, expandSlotTimes, startOfWeekIso, timeToMinutes, trimTimesFromWorkingDayStart, weekRangeLabel } from '@/utils/calendar';
import { getErrorMessage } from '@/utils/errors';
import { openWhatsApp, openWhatsAppDesktop } from '@/utils/whatsapp';
import { buildAppointmentReminderMessage, resolveWhatsAppMessageLanguage } from '@/utils/whatsappTemplates';
import { AppointmentStatus, AppointmentWithPatient, DaySchedule, Patient } from '@/types/domain';
/** Fallback slot times shown while the first day's schedule is still loading. */
const FALLBACK_TIMES = Array.from({ length: 18 }, (_, i) => {
  const totalMin = 9 * 60 + i * 30;
  const h = Math.floor(totalMin / 60)
    .toString()
    .padStart(2, '0');
  const m = (totalMin % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
});

const STATUS_OPTIONS = ALL_STATUS_OPTIONS;

interface SelectedSlot {
  date: string;
  time: string;
}

function getApiErrorCode(err: unknown): string | undefined {
  if (isAxiosError(err)) {
    const data = err.response?.data;
    if (data && typeof data === 'object' && 'code' in data) {
      return String((data as { code: string }).code);
    }
  }
  return undefined;
}

function currentTimeRounded(): string {
  const now = new Date();
  const min = Math.round(now.getMinutes() / 5) * 5;
  const h = now.getHours().toString().padStart(2, '0');
  const m = (min === 60 ? 0 : min).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function AppointmentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useUiStore();
  const print = usePrintStore((s) => s.print);
  const [searchParams] = useSearchParams();
  const canCreate = usePermission(PERMISSIONS.APPOINTMENTS_CREATE);
  const canEdit = usePermission(PERMISSIONS.APPOINTMENTS_EDIT);
  const canBookOutside = usePermission(PERMISSIONS.APPOINTMENTS_BOOK_OUTSIDE_HOURS);

  const preselectedPatientId = searchParams.get('patientId');
  const initialDate = searchParams.get('date') || todayIso();

  const [weekStart, setWeekStart] = useState(() => startOfWeekIso(initialDate, language));
  const [focusDate, setFocusDate] = useState(initialDate);
  const [slotStepMin, setSlotStepMin] = useState<15 | 30>(30);
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('week');
  const [draggingEmergency, setDraggingEmergency] = useState<AppointmentWithPatient | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [convertingEmergency, setConvertingEmergency] = useState<AppointmentWithPatient | null>(null);
  const [managingAppt, setManagingAppt] = useState<AppointmentWithPatient | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editDuration, setEditDuration] = useState(DEFAULT_DURATION);
  const [editReason, setEditReason] = useState('');
  const [editGuestName, setEditGuestName] = useState('');
  const [editGuestPhone, setEditGuestPhone] = useState('');
  const [editBookingMode, setEditBookingMode] = useState<'patient' | 'walkin'>('patient');
  const [editSelectedPatient, setEditSelectedPatient] = useState<Patient | null>(null);
  const [editPatientQuery, setEditPatientQuery] = useState('');
  const [linkQuery, setLinkQuery] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showTodayPanel, setShowTodayPanel] = useState(false);

  const [bookingMode, setBookingMode] = useState<'patient' | 'walkin'>('patient');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [reason, setReason] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [error, setError] = useState<string | null>(null);
  const [outsideHoursPrompt, setOutsideHoursPrompt] = useState<
    | { kind: 'create'; payload: CreateAppointmentPayload }
    | { kind: 'update'; id: number; payload: UpdateAppointmentPayload }
    | null
  >(null);

  const { data: preselectedPatient } = useQuery({
    queryKey: ['patient-lite', preselectedPatientId],
    queryFn: () => patientsApi.getById(Number(preselectedPatientId)),
    enabled: !!preselectedPatientId,
  });

  const { data: clinicSettings } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => settingsApi.getClinic(),
  });

  useEffect(() => {
    if (preselectedPatient) setSelectedPatient(preselectedPatient);
  }, [preselectedPatient]);

  const weekDays = useMemo(() => buildWeekDays(weekStart, language), [weekStart, language]);

  const dayQueries = useQueries({
    queries: weekDays.map((d) => ({
      queryKey: ['day-schedule', d.iso],
      queryFn: () => appointmentsApi.daySchedule(d.iso),
    })),
  });

  const baseTimes = useMemo(() => {
    const schedules = dayQueries.map((q) => q.data).filter((d): d is DaySchedule => !!d);
    const slotSource = schedules.find((d) => d.slots.length > 0)?.slots ?? [];
    const allTimes = slotSource.length > 0 ? slotSource.map((s) => s.time) : FALLBACK_TIMES;
    return trimTimesFromWorkingDayStart(
      allTimes,
      schedules,
      clinicSettings?.workStartTime ?? '09:00',
    );
  }, [dayQueries, clinicSettings?.workStartTime]);

  const times = useMemo(() => expandSlotTimes(baseTimes, slotStepMin), [baseTimes, slotStepMin]);
  const rowHeightPx = slotStepMin === 15 ? ROW_HEIGHT_PX_15 : ROW_HEIGHT_PX_30;

  const printDate = todayIso();

  const { data: printDaySchedule } = useQuery({
    queryKey: ['day-schedule', printDate],
    queryFn: () => appointmentsApi.daySchedule(printDate),
  });

  const { data: patientResults = [] } = useQuery({
    queryKey: ['patient-search-inline', patientQuery],
    queryFn: () => patientsApi.search(patientQuery),
    enabled: patientQuery.trim().length > 0 && !selectedPatient,
  });

  const { data: phoneMatches = [] } = useQuery({
    queryKey: ['patient-check-phone', guestPhone],
    queryFn: () => patientsApi.checkPhone(guestPhone.trim()),
    enabled: bookingMode === 'walkin' && guestPhone.trim().length >= 6,
  });

  const { data: linkResults = [] } = useQuery({
    queryKey: ['patient-search-link', linkQuery],
    queryFn: () => patientsApi.search(linkQuery),
    enabled: linkQuery.trim().length > 0,
  });

  const { data: editPatientResults = [] } = useQuery({
    queryKey: ['patient-search-edit', editPatientQuery],
    queryFn: () => patientsApi.search(editPatientQuery),
    enabled: editMode && editBookingMode === 'patient' && editPatientQuery.trim().length > 0 && !editSelectedPatient,
  });

  const createMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: (_data, variables) => {
      setOutsideHoursPrompt(null);
      queryClient.invalidateQueries({ queryKey: ['day-schedule', variables.date] });
      if (preselectedPatientId) {
        queryClient.invalidateQueries({ queryKey: ['patient-appointments-upcoming'] });
        navigate(`/patients/${preselectedPatientId}`);
        return;
      }
      resetBookingForm();
    },
    onError: (err, variables) => {
      if (getApiErrorCode(err) === 'OUTSIDE_WORKING_HOURS') {
        setOutsideHoursPrompt({ kind: 'create', payload: variables });
        setError(null);
        return;
      }
      setError(getErrorMessage(err, t('common.error')));
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AppointmentStatus }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: (_data, variables) => {
      if (managingAppt) {
        queryClient.invalidateQueries({ queryKey: ['day-schedule'] });
        queryClient.invalidateQueries({ queryKey: ['patient-appointments-upcoming'] });
        setManagingAppt((prev) => (prev ? { ...prev, status: variables.status } : prev));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof appointmentsApi.update>[1] }) =>
      appointmentsApi.update(id, payload),
    onSuccess: (data) => {
      setOutsideHoursPrompt(null);
      queryClient.invalidateQueries({ queryKey: ['day-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['patient-appointments-upcoming'] });
      setConvertingEmergency(null);
      setSelectedSlot(null);
      if (managingAppt && data) {
        setManagingAppt(data as AppointmentWithPatient);
      }
      setEditMode(false);
      setError(null);
    },
    onError: (err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['day-schedule'] });
      if (getApiErrorCode(err) === 'OUTSIDE_WORKING_HOURS') {
        setOutsideHoursPrompt({ kind: 'update', id: variables.id, payload: variables.payload });
        setError(null);
        return;
      }
      setError(getErrorMessage(err, t('common.error')));
    },
  });

  const reminderMutation = useMutation({
    mutationFn: (id: number) => appointmentsApi.recordReminderSent(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['day-schedule', data.date] });
      setManagingAppt(data as AppointmentWithPatient);
    },
  });

  const linkPatientMutation = useMutation({
    mutationFn: ({ id, patientId }: { id: number; patientId: number }) =>
      appointmentsApi.linkPatient(id, patientId),
    onSuccess: () => {
      if (managingAppt) {
        queryClient.invalidateQueries({ queryKey: ['day-schedule', managingAppt.date] });
        queryClient.invalidateQueries({ queryKey: ['patient-appointments-upcoming'] });
      }
      closeManagePanel();
    },
    onError: (err) => setLinkError(getErrorMessage(err, t('common.error'))),
  });

  const createPatientAndLinkMutation = useMutation({
    mutationFn: async () => {
      if (!managingAppt) return;
      const newPatient = await patientsApi.create({
        fullName: managingAppt.guestName ?? '',
        phone: managingAppt.guestPhone ?? '',
      });
      await appointmentsApi.linkPatient(managingAppt.id, newPatient.id);
      return newPatient;
    },
    onSuccess: (newPatient) => {
      if (managingAppt) {
        queryClient.invalidateQueries({ queryKey: ['day-schedule', managingAppt.date] });
        queryClient.invalidateQueries({ queryKey: ['patient-appointments-upcoming'] });
      }
      closeManagePanel();
      if (newPatient) navigate(`/patients/${newPatient.id}`);
    },
    onError: (err) => {
      if (isAxiosError(err) && err.response?.status === 409) {
        setLinkError(t('appointmentsPage.manage.duplicatePhoneHint'));
        return;
      }
      setLinkError(getErrorMessage(err, t('common.error')));
    },
  });

  function resetBookingForm() {
    setSelectedSlot(null);
    setConvertingEmergency(null);
    setSelectedPatient(preselectedPatient ?? null);
    setBookingMode('patient');
    setPatientQuery('');
    setGuestName('');
    setGuestPhone('');
    setReason('');
    setStartTime('');
    setDuration(DEFAULT_DURATION);
    setError(null);
    setOutsideHoursPrompt(null);
  }

  function confirmBookOutsideHours() {
    if (!outsideHoursPrompt || !canBookOutside) return;
    if (outsideHoursPrompt.kind === 'create') {
      createMutation.mutate({ ...outsideHoursPrompt.payload, allowOutsideHours: true });
    } else {
      updateMutation.mutate({
        id: outsideHoursPrompt.id,
        payload: { ...outsideHoursPrompt.payload, allowOutsideHours: true },
      });
    }
  }

  const showOutsideHoursWarning =
    outsideHoursPrompt &&
    ((outsideHoursPrompt.kind === 'create' && selectedSlot) ||
      (outsideHoursPrompt.kind === 'update' && editMode));

  function handleSendReminder() {
    if (!managingAppt || !clinicSettings) return;
    const phone = managingAppt.patientId ? managingAppt.patientPhone : managingAppt.guestPhone;
    const msgLocale = resolveWhatsAppMessageLanguage(clinicSettings) === 'ar' ? 'ar' : 'en';
    const message = buildAppointmentReminderMessage(clinicSettings, {
      clinicName: clinicSettings.clinicName?.trim() || t('app.name'),
      patientName: managingAppt.patientName,
      appointmentDate: formatDateDisplay(managingAppt.date, msgLocale),
      appointmentTime: managingAppt.time,
      appointmentReason: managingAppt.reason,
    });
    if (!openWhatsAppDesktop(phone, message)) return;
    reminderMutation.mutate(managingAppt.id);
  }

  const sendApptActiveAppointments = useMemo(() => {
    const appointments = printDaySchedule?.appointments ?? [];
    return appointments
      .filter((a) => a.status !== 'CANCELLED' && !isEmergencyAppointment(a))
      .slice()
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [printDaySchedule]);

  const printAppointments = sendApptActiveAppointments;

  const printEmergencies = useMemo(() => {
    const appointments = printDaySchedule?.appointments ?? [];
    return appointments
      .filter((a) => a.appointmentType === EMERGENCY_TYPE && a.status !== 'CANCELLED')
      .slice()
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [printDaySchedule]);

  const printPatientIds = useMemo(() => {
    const ids = new Set<number>();
    for (const a of [...printAppointments, ...printEmergencies]) {
      if (a.patientId) ids.add(a.patientId);
    }
    return [...ids];
  }, [printAppointments, printEmergencies]);

  const printSummaryQueries = useQueries({
    queries: printPatientIds.map((id) => ({
      queryKey: ['print-patient-summary', id],
      queryFn: () => fetchPatientPrintSummary(id),
      staleTime: 60_000,
    })),
  });

  const printPatientSummaries = useMemo(() => {
    const map = new Map<number, Awaited<ReturnType<typeof fetchPatientPrintSummary>>>();
    printSummaryQueries.forEach((q, idx) => {
      if (q.data) map.set(printPatientIds[idx], q.data);
    });
    return map;
  }, [printSummaryQueries, printPatientIds]);

  function handleSendTodaysAppointments() {
    const doctorPhone = clinicSettings?.doctorPhone;
    if (!doctorPhone || sendApptActiveAppointments.length === 0) return;
    const clinicName = clinicSettings?.clinicName || t('app.name');
    const header = t('whatsapp.todaysAppointmentsHeader', {
      clinicName,
      date: formatDateDisplay(printDate, language),
    });
    const lines = sendApptActiveAppointments.map((a) =>
      a.reason ? `${a.time} - ${a.patientName} - ${a.reason}` : `${a.time} - ${a.patientName}`,
    );
    openWhatsApp(doctorPhone, [header, ...lines].join('\n'));
  }

  function closeManagePanel() {
    setManagingAppt(null);
    setEditMode(false);
    setLinkQuery('');
    setLinkError(null);
    setError(null);
    setOutsideHoursPrompt(null);
  }

  function startEditMode() {
    if (!managingAppt) return;
    setEditDate(managingAppt.date);
    setEditStartTime(managingAppt.time);
    setEditDuration(managingAppt.durationMin || DEFAULT_DURATION);
    setEditReason(managingAppt.reason ?? '');
    setEditGuestName(managingAppt.guestName ?? '');
    setEditGuestPhone(managingAppt.guestPhone ?? '');
    if (managingAppt.patientId) {
      setEditBookingMode('patient');
      setEditSelectedPatient({
        id: managingAppt.patientId,
        fullName: managingAppt.patientName,
        fileNumber: managingAppt.patientFileNumber ?? '',
        phone: managingAppt.patientPhone ?? '',
        gender: null,
        dateOfBirth: null,
        approxAge: null,
        weightKg: null,
        guarantorId: null,
        address: null,
        areaId: null,
        medicalNotes: null,
        generalNotes: null,
        familyGroupId: null,
        createdAt: '',
        updatedAt: '',
      });
      setEditPatientQuery('');
    } else {
      setEditBookingMode('walkin');
      setEditSelectedPatient(null);
      setEditPatientQuery('');
    }
    setEditMode(true);
    setError(null);
  }

  function cancelEditMode() {
    setEditMode(false);
    setError(null);
    setOutsideHoursPrompt(null);
  }

  function handleEditSave() {
    if (!managingAppt) return;
    if (!/^\d{2}:\d{2}$/.test(editStartTime)) {
      setError(t('appointmentsPage.invalidTime'));
      return;
    }
    if (editBookingMode === 'patient') {
      if (!editSelectedPatient) {
        setError(t('appointmentsPage.selectPatient'));
        return;
      }
      updateMutation.mutate({
        id: managingAppt.id,
        payload: {
          patientId: editSelectedPatient.id,
          date: editDate,
          time: editStartTime,
          durationMin: editDuration,
          reason: editReason.trim() || undefined,
        },
      });
      return;
    }
    if (!editGuestName.trim() || !editGuestPhone.trim()) {
      setError(t('appointmentsPage.walkin.validation'));
      return;
    }
    updateMutation.mutate({
      id: managingAppt.id,
      payload: {
        date: editDate,
        time: editStartTime,
        durationMin: editDuration,
        reason: editReason.trim() || undefined,
        guestName: editGuestName.trim(),
        guestPhone: editGuestPhone.trim(),
      },
    });
  }

  function goToMonth(deltaMonths: number) {
    const [y, m, day] = focusDate.split('-').map(Number);
    const target = new Date(y, m - 1 + deltaMonths, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay));
    const iso = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    setFocusDate(iso);
    setWeekStart(startOfWeekIso(iso, language));
  }

  function goToWeek(deltaWeeks: number) {
    setWeekStart((prev) => {
      const next = localAddDaysIso(prev, deltaWeeks * 7);
      setFocusDate(next);
      return next;
    });
  }

  function goToToday() {
    const today = todayIso();
    setWeekStart(startOfWeekIso(today, language));
    setFocusDate(today);
  }

  function openTodayBrief() {
    goToToday();
    setShowTodayPanel(true);
  }

  function handleFocusDateChange(iso: string) {
    setFocusDate(iso);
    setWeekStart(startOfWeekIso(iso, language));
  }

  function patchDaySchedule(date: string, updater: (day: DaySchedule) => DaySchedule) {
    queryClient.setQueryData<DaySchedule>(['day-schedule', date], (old) => {
      if (!old) return old;
      return updater(old);
    });
  }

  const handleDragWeekShift = useCallback((deltaWeeks: number) => {
    setWeekStart((prev) => localAddDaysIso(prev, deltaWeeks * 7));
  }, []);

  function handleAppointmentMove(appt: AppointmentWithPatient, date: string, time: string) {
    if (!canEdit) return;

    const targetSchedule = queryClient.getQueryData<DaySchedule>(['day-schedule', date]);
    const appointments = (targetSchedule?.appointments ?? []).filter((a) => !isEmergencyAppointment(a));
    const durationMin = appt.durationMin || DEFAULT_DURATION;
    if (appointmentOverlaps(appointments, timeToMinutes(time), durationMin, appt.id)) {
      setError(t('appointmentsPage.overlapError'));
      return;
    }

    const moved: AppointmentWithPatient = { ...appt, date, time };
    if (appt.date !== date) {
      patchDaySchedule(appt.date, (day) => ({
        ...day,
        appointments: day.appointments.filter((a) => a.id !== appt.id),
      }));
    }
    patchDaySchedule(date, (day) => ({
      ...day,
      appointments: [...day.appointments.filter((a) => a.id !== appt.id), moved].sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
      ),
    }));

    updateMutation.mutate({ id: appt.id, payload: { date, time } });
    if (date !== appt.date) {
      const newWeekStart = startOfWeekIso(date, language);
      setWeekStart((prev) => (prev === newWeekStart ? prev : newWeekStart));
      setFocusDate(date);
    }
  }

  function handleEmergencyDrop(appt: AppointmentWithPatient, date: string, time: string) {
    if (!canEdit) return;
    updateMutation.mutate(
      {
        id: appt.id,
        payload: {
          appointmentType: 'CHECKUP',
          date,
          time,
          durationMin: appt.durationMin || DEFAULT_DURATION,
          allowOutsideHours: true,
        },
      },
      {
        onSuccess: () => {
          statusMutation.mutate({ id: appt.id, status: 'SCHEDULED' });
          setFocusDate(date);
          setWeekStart(startOfWeekIso(date, language));
        },
      },
    );
  }

  async function handlePrint() {
    const clinic = await loadClinicPrintInfo();
    print(
      <AppointmentsPrintView
        dateLabel={printDateLabel}
        appointments={printAppointments}
        emergencies={printEmergencies}
        patientSummaries={printPatientSummaries}
        language={language}
        clinic={clinic}
      />,
    );
  }

  function handleSlotSelect(date: string, time: string) {
    if (!canCreate) return;
    setSelectedSlot({ date, time });
    if (!selectedPatient) setSelectedPatient(preselectedPatient ?? null);
    setBookingMode('patient');
    setPatientQuery('');
    setGuestName('');
    setGuestPhone('');
    setReason('');
    setStartTime(time);
    setDuration(DEFAULT_DURATION);
    setError(null);
  }

  function handleAppointmentOpen(appt: AppointmentWithPatient) {
    setShowTodayPanel(false);
    setManagingAppt(appt);
    setEditMode(false);
    setLinkQuery('');
    setLinkError(null);
  }

  function handleFabClick() {
    if (!canCreate) return;
    handleSlotSelect(focusDate, currentTimeRounded());
  }

  function handleSave() {
    if (!selectedSlot) return;
    const time = startTime || selectedSlot.time;
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setError(t('appointmentsPage.invalidTime'));
      return;
    }

    if (convertingEmergency) {
      const basePayload: UpdateAppointmentPayload = {
        date: selectedSlot.date,
        time,
        durationMin: duration,
        reason: reason.trim() || undefined,
        appointmentType: 'CHECKUP',
      };
      if (bookingMode === 'patient' && selectedPatient) {
        updateMutation.mutate({
          id: convertingEmergency.id,
          payload: { ...basePayload, patientId: selectedPatient.id },
        });
        setConvertingEmergency(null);
        setSelectedSlot(null);
        return;
      }
      if (bookingMode === 'walkin' && guestName.trim() && guestPhone.trim()) {
        updateMutation.mutate({
          id: convertingEmergency.id,
          payload: {
            ...basePayload,
            guestName: guestName.trim(),
            guestPhone: guestPhone.trim(),
          },
        });
        setConvertingEmergency(null);
        setSelectedSlot(null);
        return;
      }
      setError(t('appointmentsPage.selectPatient'));
      return;
    }

    if (bookingMode === 'patient') {
      if (!selectedPatient) {
        setError(t('appointmentsPage.selectPatient'));
        return;
      }
      createMutation.mutate({
        patientId: selectedPatient.id,
        date: selectedSlot.date,
        time,
        durationMin: duration,
        reason: reason.trim() || undefined,
      });
      return;
    }

    if (!guestName.trim() || !guestPhone.trim()) {
      setError(t('appointmentsPage.walkin.validation'));
      return;
    }
    createMutation.mutate({
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      date: selectedSlot.date,
      time,
      durationMin: duration,
      reason: reason.trim() || undefined,
    });
  }

  const dayColumns = weekDays.map((d, idx) => ({
    ...d,
    schedule: dayQueries[idx]?.data,
  }));

  const printDateLabel = formatDateDisplay(printDate, language);
  const monthNavLabel = new Date(`${focusDate}T12:00:00`).toLocaleDateString(language, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="appointments-page">
      <div className="agenda-layout">
        <div className="agenda-layout__calendar">
          <div className="calendar-top">
            <div className="calendar-top__nav">
              {calendarView === 'week' ? (
                <>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => goToWeek(-1)}
                    title={t('appointmentsPage.previousWeek') ?? ''}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="calendar-week-nav__label">{weekRangeLabel(weekStart, language)}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => goToWeek(1)}
                    title={t('appointmentsPage.nextWeek') ?? ''}
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => goToMonth(-1)}
                    title={t('appointmentsPage.previousMonth') ?? ''}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="calendar-week-nav__label">{monthNavLabel}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => goToMonth(1)}
                    title={t('appointmentsPage.nextMonth') ?? ''}
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
              <button type="button" className="btn btn--ghost btn--small" onClick={openTodayBrief}>
                {t('common.today')}
              </button>
            </div>
          </div>

          {calendarView === 'week' ? (
            <WeekCalendar
              dayColumns={dayColumns}
              times={times}
              slotStepMin={slotStepMin}
              rowHeightPx={rowHeightPx}
              language={language}
              isRtl={language === 'ar'}
              focusDate={focusDate}
              canCreate={canCreate}
              canEdit={canEdit}
              selectedSlot={selectedSlot}
              draggingEmergency={draggingEmergency}
              onSlotSelect={handleSlotSelect}
              onAppointmentOpen={handleAppointmentOpen}
              onAppointmentMove={handleAppointmentMove}
              onDragWeekShift={handleDragWeekShift}
              onEmergencyDrop={handleEmergencyDrop}
              onEmergencyDragEnd={() => setDraggingEmergency(null)}
              isUpdating={updateMutation.isPending}
            />
          ) : (
            <MonthCalendar
              focusDate={focusDate}
              language={language}
              onDaySelect={handleFocusDateChange}
            />
          )}
        </div>

        <AgendaSidebar
          language={language}
          focusDate={focusDate}
          calendarView={calendarView}
          onCalendarViewChange={setCalendarView}
          slotStepMin={slotStepMin}
          onFocusDateChange={handleFocusDateChange}
          onSlotStepChange={setSlotStepMin}
          onOpenPatient={(id) => navigate(`/patients/${id}`)}
          onManageEmergency={(appt) => {
            setManagingAppt(appt);
            setEditMode(false);
          }}
          draggingEmergency={draggingEmergency}
          onEmergencyDragStart={setDraggingEmergency}
          onEmergencyDragEnd={() => setDraggingEmergency(null)}
        />
      </div>

      {canCreate && (
        <button
          type="button"
          className="agenda-fab"
          onClick={handleFabClick}
          title={t('appointmentsPage.newAppointment') ?? ''}
        >
          <Plus size={22} />
        </button>
      )}

      {canCreate && selectedSlot && (
        <div className="appointment-form-overlay" onClick={resetBookingForm}>
          <div className="appointment-form-panel" onClick={(e) => e.stopPropagation()}>
            <div className="appointment-form-panel__header">
              <h3>
                {convertingEmergency
                  ? t('appointmentsPage.emergency.convertToRegular')
                  : t('appointmentsPage.newAppointment')}{' '}
                · {formatDateDisplay(selectedSlot.date, language)} · {selectedSlot.time}
              </h3>
              <button className="icon-btn" onClick={resetBookingForm}>
                <X size={16} />
              </button>
            </div>

            {!preselectedPatientId && (
              <div className="booking-mode-toggle">
                <button
                  type="button"
                  className={bookingMode === 'patient' ? 'booking-mode-toggle__btn booking-mode-toggle__btn--active' : 'booking-mode-toggle__btn'}
                  onClick={() => setBookingMode('patient')}
                >
                  {t('appointmentsPage.existingPatient')}
                </button>
                <button
                  type="button"
                  className={bookingMode === 'walkin' ? 'booking-mode-toggle__btn booking-mode-toggle__btn--active' : 'booking-mode-toggle__btn'}
                  onClick={() => setBookingMode('walkin')}
                >
                  {t('appointmentsPage.walkin.tabLabel')}
                </button>
              </div>
            )}

            {bookingMode === 'patient' ? (
              selectedPatient ? (
                <div className="selected-patient-chip">
                  <span>
                    {selectedPatient.fullName} · {selectedPatient.fileNumber}
                  </span>
                  {!preselectedPatientId && (
                    <button className="link-btn" onClick={() => setSelectedPatient(null)}>
                      {t('common.edit')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="patient-picker">
                  <input
                    autoFocus
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder={t('appointmentsPage.selectPatientPlaceholder') ?? ''}
                  />
                  {patientQuery.trim() && (
                    <ul className="patient-picker__results">
                      {patientResults.slice(0, 6).map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPatient(p);
                              setPatientQuery('');
                            }}
                          >
                            {p.fullName} · {p.phone}
                          </button>
                        </li>
                      ))}
                      {patientResults.length === 0 && (
                        <li className="muted patient-picker__empty">{t('common.noResults')}</li>
                      )}
                    </ul>
                  )}
                </div>
              )
            ) : (
              <div className="walkin-form">
                <label className="form-field">
                  <span className="form-field__label">{t('appointmentsPage.walkin.name')}</span>
                  <input
                    autoFocus
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={t('appointmentsPage.walkin.namePlaceholder') ?? ''}
                  />
                </label>
                <label className="form-field">
                  <span className="form-field__label">{t('appointmentsPage.walkin.phone')}</span>
                  <input
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder={t('appointmentsPage.walkin.phonePlaceholder') ?? ''}
                  />
                </label>
                {phoneMatches.length > 0 && (
                  <div className="phone-match-hint">
                    <span className="muted">{t('appointmentsPage.walkin.existingMatchHint')}</span>
                    <ul>
                      {phoneMatches.slice(0, 3).map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => {
                              setSelectedPatient(p);
                              setBookingMode('patient');
                              setGuestName('');
                              setGuestPhone('');
                            }}
                          >
                            {p.fullName} · {p.fileNumber}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="appointment-time-row">
              <label className="form-field form-field--narrow">
                <span className="form-field__label">{t('appointmentsPage.startTime')}</span>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-field__label">{t('appointmentsPage.duration')}</span>
                <div className="duration-picker">
                  {DURATION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={d === duration ? 'day-toggle-btn day-toggle-btn--active' : 'day-toggle-btn'}
                      onClick={() => setDuration(d)}
                    >
                      {t('appointmentsPage.durationMinutes', { count: d })}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <label className="form-field">
              <span className="form-field__label">{t('appointmentsPage.reason')}</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('appointmentsPage.reasonPlaceholder') ?? ''}
              />
            </label>

            {showOutsideHoursWarning && outsideHoursPrompt?.kind === 'create' && (
              <div className="outside-hours-warning">
                <p>{t('appointmentsPage.outsideHoursWarning')}</p>
                {canBookOutside ? (
                  <div className="outside-hours-warning__actions">
                    <button type="button" className="btn btn--primary btn--small" onClick={confirmBookOutsideHours} disabled={createMutation.isPending}>
                      {t('appointmentsPage.bookAnyway')}
                    </button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setOutsideHoursPrompt(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <p className="muted">{t('appointmentsPage.outsideHoursNoPermission')}</p>
                )}
              </div>
            )}

            {error && <div className="form-error-banner">{error}</div>}

            <div className="form-actions">
              <button className="btn btn--ghost" onClick={resetBookingForm}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--primary" onClick={handleSave} disabled={createMutation.isPending}>
                {t('appointmentsPage.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTodayPanel && (
        <TodaysBriefPanel
          dateIso={printDate}
          language={language}
          appointments={printAppointments}
          emergencies={printEmergencies}
          patientSummaries={printPatientSummaries}
          canSendWhatsApp={!!clinicSettings?.doctorPhone && sendApptActiveAppointments.length > 0}
          onClose={() => setShowTodayPanel(false)}
          onPrint={handlePrint}
          onSendWhatsApp={handleSendTodaysAppointments}
          onAppointmentSelect={handleAppointmentOpen}
        />
      )}

      {managingAppt && (
        <div className="appointment-form-overlay" onClick={closeManagePanel}>
          <div className="appointment-form-panel" onClick={(e) => e.stopPropagation()}>
            <div className="appointment-form-panel__header">
              <h3>
                {editMode
                  ? t('appointmentsPage.editAppointment')
                  : `${managingAppt.patientName} · ${formatDateDisplay(managingAppt.date, language)} · ${managingAppt.time}`}
              </h3>
              <button className="icon-btn" onClick={closeManagePanel}>
                <X size={16} />
              </button>
            </div>

            {editMode ? (
              <>
                <div className="booking-mode-tabs">
                  <button
                    type="button"
                    className={editBookingMode === 'patient' ? 'booking-mode-tab booking-mode-tab--active' : 'booking-mode-tab'}
                    onClick={() => setEditBookingMode('patient')}
                  >
                    {t('appointmentsPage.existingPatient')}
                  </button>
                  <button
                    type="button"
                    className={editBookingMode === 'walkin' ? 'booking-mode-tab booking-mode-tab--active' : 'booking-mode-tab'}
                    onClick={() => {
                      setEditBookingMode('walkin');
                      setEditSelectedPatient(null);
                      setEditPatientQuery('');
                    }}
                  >
                    {t('appointmentsPage.walkin.tabLabel')}
                  </button>
                </div>

                {editBookingMode === 'patient' ? (
                  editSelectedPatient ? (
                    <div className="selected-patient-chip">
                      <span>
                        {editSelectedPatient.fullName} · {editSelectedPatient.fileNumber}
                      </span>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => {
                          setEditSelectedPatient(null);
                          setEditPatientQuery('');
                        }}
                      >
                        {t('common.edit')}
                      </button>
                    </div>
                  ) : (
                    <label className="form-field">
                      <span className="form-field__label">{t('appointmentsPage.selectPatient')}</span>
                      <input
                        value={editPatientQuery}
                        onChange={(e) => setEditPatientQuery(e.target.value)}
                        placeholder={t('appointmentsPage.selectPatientPlaceholder') ?? ''}
                      />
                      {editPatientQuery.trim() && editPatientResults.length > 0 && (
                        <ul className="patient-search-dropdown">
                          {editPatientResults.slice(0, 8).map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() => {
                                  setEditSelectedPatient(p);
                                  setEditPatientQuery('');
                                }}
                              >
                                {p.fullName} · {p.fileNumber} · {p.phone}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </label>
                  )
                ) : (
                  <div className="walkin-form">
                    <label className="form-field">
                      <span className="form-field__label">{t('appointmentsPage.walkin.name')}</span>
                      <input
                        value={editGuestName}
                        onChange={(e) => setEditGuestName(e.target.value)}
                        placeholder={t('appointmentsPage.walkin.namePlaceholder') ?? ''}
                      />
                    </label>
                    <label className="form-field">
                      <span className="form-field__label">{t('appointmentsPage.walkin.phone')}</span>
                      <input
                        value={editGuestPhone}
                        onChange={(e) => setEditGuestPhone(e.target.value)}
                        placeholder={t('appointmentsPage.walkin.phonePlaceholder') ?? ''}
                      />
                    </label>
                  </div>
                )}

                <label className="form-field">
                  <span className="form-field__label">{t('common.date')}</span>
                  <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                </label>

                <div className="appointment-time-row">
                  <label className="form-field form-field--narrow">
                    <span className="form-field__label">{t('appointmentsPage.startTime')}</span>
                    <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span className="form-field__label">{t('appointmentsPage.duration')}</span>
                    <div className="duration-picker">
                      {DURATION_OPTIONS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={d === editDuration ? 'day-toggle-btn day-toggle-btn--active' : 'day-toggle-btn'}
                          onClick={() => setEditDuration(d)}
                        >
                          {t('appointmentsPage.durationMinutes', { count: d })}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>

                <label className="form-field">
                  <span className="form-field__label">{t('appointmentsPage.reason')}</span>
                  <input
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder={t('appointmentsPage.reasonPlaceholder') ?? ''}
                  />
                </label>

                {showOutsideHoursWarning && outsideHoursPrompt?.kind === 'update' && (
                  <div className="outside-hours-warning">
                    <p>{t('appointmentsPage.outsideHoursWarning')}</p>
                    {canBookOutside ? (
                      <div className="outside-hours-warning__actions">
                        <button type="button" className="btn btn--primary btn--small" onClick={confirmBookOutsideHours} disabled={updateMutation.isPending}>
                          {t('appointmentsPage.bookAnyway')}
                        </button>
                        <button type="button" className="btn btn--ghost btn--small" onClick={() => setOutsideHoursPrompt(null)}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    ) : (
                      <p className="muted">{t('appointmentsPage.outsideHoursNoPermission')}</p>
                    )}
                  </div>
                )}

                {error && <div className="form-error-banner">{error}</div>}

                <div className="form-actions">
                  <button type="button" className="btn btn--ghost" onClick={cancelEditMode}>
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleEditSave}
                    disabled={updateMutation.isPending}
                  >
                    {t('common.save')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="appointment-manage-details">
                  <div className="appointment-manage-details__row">
                    <span className="appointment-manage-details__label">{t('followUp.columns.patient')}</span>
                    <span className={managingAppt.status === 'CANCELLED' ? 'appointment-manage-details__cancelled' : ''}>
                      {managingAppt.patientName}
                      {!managingAppt.patientId && (
                        <span className="appointment-card__guest-tag">{t('appointmentsPage.walkin.tag')}</span>
                      )}
                    </span>
                  </div>
                  <div className="appointment-manage-details__row">
                    <span className="appointment-manage-details__label">{t('common.date')}</span>
                    <span>{formatDateDisplay(managingAppt.date, language)}</span>
                  </div>
                  <div className="appointment-manage-details__row">
                    <span className="appointment-manage-details__label">{t('common.time')}</span>
                    <span>{managingAppt.time}</span>
                  </div>
                  <div className="appointment-manage-details__row">
                    <span className="appointment-manage-details__label">{t('appointmentsPage.duration')}</span>
                    <span>{t('appointmentsPage.durationMinutes', { count: managingAppt.durationMin })}</span>
                  </div>
                  <div className="appointment-manage-details__row">
                    <span className="appointment-manage-details__label">{t('appointmentsPage.reason')}</span>
                    <span>{managingAppt.reason || '—'}</span>
                  </div>
                  {managingAppt.outsideWorkingHours && (
                    <div className="appointment-manage-details__row appointment-manage-details__row--warning">
                      <span className="appointment-manage-details__label">{t('appointmentsPage.workingHours')}</span>
                      <span>{t('appointmentsPage.outsideHoursTag')}</span>
                    </div>
                  )}
                  <div className="appointment-manage-details__row">
                    <span className="appointment-manage-details__label">{t('common.status')}</span>
                    <span>{t(`appointmentsPage.status.${managingAppt.status}`)}</span>
                  </div>
                  {managingAppt.reminderSentAt && (
                    <div className="appointment-manage-details__row">
                      <span className="appointment-manage-details__label">{t('appointmentsPage.manage.reminder')}</span>
                      <span className="appointment-manage-reminder">
                        {t('appointmentsPage.remindedAt', {
                          time: formatTimeDisplay(managingAppt.reminderSentAt, language),
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="form-actions form-actions--start">
                  <button
                    type="button"
                    className="btn btn--ghost btn--small btn--whatsapp"
                    onClick={handleSendReminder}
                    disabled={
                      reminderMutation.isPending ||
                      !(managingAppt.patientId ? managingAppt.patientPhone : managingAppt.guestPhone)
                    }
                  >
                    <MessageCircle size={13} /> {t('whatsapp.sendReminder')}
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={startEditMode}>
                    {t('appointmentsPage.editAppointment')}
                  </button>
                </div>

                <div className="status-action-group">
                  <span className="form-field__label">{t('appointmentsPage.manage.changeStatus')}</span>
                  {managingAppt.status === 'SCHEDULED' && (
                    <button
                      type="button"
                      className="btn btn--primary btn--small"
                      style={{ marginBottom: 8 }}
                      onClick={() => statusMutation.mutate({ id: managingAppt.id, status: 'WAITING' })}
                      disabled={statusMutation.isPending}
                    >
                      {t('appointmentsPage.markArrived')}
                    </button>
                  )}
                  <div className="status-action-group__buttons">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={[
                          'status-action-btn',
                          `status-action-btn--${s.toLowerCase()}`,
                          managingAppt.status === s ? 'status-action-btn--active' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => statusMutation.mutate({ id: managingAppt.id, status: s })}
                        disabled={statusMutation.isPending}
                      >
                        {t(`appointmentsPage.status.${s}`)}
                      </button>
                    ))}
                  </div>
                </div>

                {!managingAppt.patientId && (
                  <div className="link-patient-panel">
                    <span className="form-field__label">{t('appointmentsPage.manage.linkPatient')}</span>
                    <p className="muted">
                      {managingAppt.guestName} · {managingAppt.guestPhone}
                    </p>

                    <button
                      type="button"
                      className="btn btn--primary btn--small"
                      onClick={() => createPatientAndLinkMutation.mutate()}
                      disabled={createPatientAndLinkMutation.isPending}
                    >
                      {t('appointmentsPage.manage.createPatientRecord')}
                    </button>

                    <div className="patient-picker">
                      <input
                        value={linkQuery}
                        onChange={(e) => setLinkQuery(e.target.value)}
                        placeholder={t('appointmentsPage.manage.linkExistingPlaceholder') ?? ''}
                      />
                      {linkQuery.trim() && (
                        <ul className="patient-picker__results">
                          {linkResults.slice(0, 6).map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => linkPatientMutation.mutate({ id: managingAppt.id, patientId: p.id })}
                              >
                                {p.fullName} · {p.phone}
                              </button>
                            </li>
                          ))}
                          {linkResults.length === 0 && (
                            <li className="muted patient-picker__empty">{t('common.noResults')}</li>
                          )}
                        </ul>
                      )}
                    </div>

                    {linkError && <div className="form-error-banner">{linkError}</div>}
                  </div>
                )}

                {managingAppt.patientId && (
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => {
                        const id = managingAppt.patientId;
                        closeManagePanel();
                        if (id) navigate(`/patients/${id}`);
                      }}
                    >
                      {t('appointmentsPage.manage.openPatientRecord')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
