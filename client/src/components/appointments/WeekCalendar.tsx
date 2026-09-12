import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppointmentWithPatient, DaySchedule } from '@/types/domain';
import { minutesToTime, timeToMinutes, formatClockTime } from '@/utils/calendar';
import { localAddDaysIso } from '@/utils/date';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  CALENDAR_HEADER_ROW_PX,
  CALENDAR_MIN_CARD_HEIGHT_PX,
  CALENDAR_MOBILE_MIN_CARD_HEIGHT_PX,
  CALENDAR_MOBILE_BREAKPOINT,
  CALENDAR_MOBILE_TIME_COLUMN_PX,
  CALENDAR_TIME_COLUMN_PX,
  DEFAULT_DURATION,
  DRAG_THRESHOLD_PX,
  appointmentOverlaps,
  isEmergencyAppointment,
} from './constants';

export interface WeekDayColumn {
  iso: string;
  day: number;
  weekday: string;
  isToday: boolean;
  schedule: DaySchedule | undefined;
}

interface PendingApptDrag {
  appt: AppointmentWithPatient;
  date: string;
  startX: number;
  startY: number;
}

interface ApptDragState {
  appt: AppointmentWithPatient;
  originDate: string;
  originMinute: number;
  previewDate: string;
  previewMinute: number;
  pointerX: number;
  pointerY: number;
  dropValid: boolean;
}

interface WeekCalendarProps {
  dayColumns: WeekDayColumn[];
  times: string[];
  slotStepMin: 15 | 30;
  rowHeightPx: number;
  language: string;
  isRtl?: boolean;
  focusDate: string;
  canCreate: boolean;
  canEdit: boolean;
  selectedSlot: { date: string; time: string } | null;
  draggingEmergency: AppointmentWithPatient | null;
  onSlotSelect: (date: string, time: string) => void;
  onAppointmentOpen: (appt: AppointmentWithPatient) => void;
  onAppointmentMove: (appt: AppointmentWithPatient, date: string, time: string) => void;
  onDragWeekShift?: (deltaWeeks: number) => void;
  onEmergencyDrop: (appt: AppointmentWithPatient, date: string, time: string) => void;
  onEmergencyDragEnd: () => void;
  isUpdating: boolean;
}

function isDayClosed(schedule: DaySchedule | undefined): boolean {
  if (!schedule) return false;
  return schedule.isClosed ?? !schedule.isWorkingDay;
}

function findCoveringAppointment(
  appointments: AppointmentWithPatient[] | undefined,
  slotTime: string,
  slotStepMin: number,
): AppointmentWithPatient | undefined {
  if (!appointments) return undefined;
  const slotStart = timeToMinutes(slotTime);
  const slotEnd = slotStart + slotStepMin;
  return appointments.find((a) => {
    if (a.status === 'CANCELLED') return false;
    const start = timeToMinutes(a.time);
    const end = start + (a.durationMin || DEFAULT_DURATION);
    return start < slotEnd && slotStart < end;
  });
}

function canPlaceAt(
  dayColumns: WeekDayColumn[],
  date: string,
  startMinute: number,
  durationMin: number,
  excludeApptId: number,
): boolean {
  const day = dayColumns.find((d) => d.iso === date);
  if (!day || isDayClosed(day.schedule)) return false;
  const appointments = (day.schedule?.appointments ?? []).filter((a) => !isEmergencyAppointment(a));
  return !appointmentOverlaps(appointments, startMinute, durationMin, excludeApptId);
}

function resolveDropTargetFromGrid(
  clientX: number,
  clientY: number,
  gridEl: HTMLDivElement,
  dayIsos: string[],
  times: string[],
  slotStepMin: number,
  rowHeightPx: number,
  isRtl: boolean,
): { date: string; minute: number } | null {
  if (dayIsos.length === 0 || times.length === 0) return null;

  const gridRect = gridEl.getBoundingClientRect();
  const cornerEl = gridEl.querySelector('.week-agenda__corner');
  const timeColWidth = cornerEl?.getBoundingClientRect().width ?? CALENDAR_TIME_COLUMN_PX;
  const bodyTop = gridRect.top + CALENDAR_HEADER_ROW_PX;
  const gridLeft = gridRect.left + timeColWidth;
  const gridBodyWidth = gridRect.width - timeColWidth;

  if (clientY < bodyTop - 8 || clientY > gridRect.bottom + 8) return null;
  if (clientX < gridRect.left - 16 || clientX > gridRect.right + 16) return null;

  let colIndex = Math.min(
    dayIsos.length - 1,
    Math.max(0, Math.floor((clientX - gridLeft) / (gridBodyWidth / dayIsos.length))),
  );
  if (isRtl) {
    colIndex = dayIsos.length - 1 - colIndex;
  }
  const date = dayIsos[colIndex];
  if (!date) return null;

  const relativeY = Math.max(0, clientY - bodyTop);
  const rowIndex = Math.min(times.length - 1, Math.floor(relativeY / rowHeightPx));
  const dayStart = timeToMinutes(times[0]);
  const minute = dayStart + rowIndex * slotStepMin;
  return { date, minute };
}

function resolveDropTarget(
  clientX: number,
  clientY: number,
  times: string[],
  slotStepMin: number,
  rowHeightPx: number,
  gridEl: HTMLDivElement | null,
  dayIsos: string[],
  isRtl: boolean,
): { date: string; minute: number } | null {
  if (gridEl) {
    const fromGrid = resolveDropTargetFromGrid(
      clientX,
      clientY,
      gridEl,
      dayIsos,
      times,
      slotStepMin,
      rowHeightPx,
      isRtl,
    );
    if (fromGrid) return fromGrid;
  }
  const el = document.elementFromPoint(clientX, clientY);
  const dayEl = el?.closest('[data-day-iso]') as HTMLElement | null;
  if (!dayEl) return null;
  const date = dayEl.getAttribute('data-day-iso');
  if (!date || times.length === 0) return null;
  const rect = dayEl.getBoundingClientRect();
  const relativeY = Math.max(0, clientY - rect.top);
  const rowIndex = Math.min(times.length - 1, Math.floor(relativeY / rowHeightPx));
  const dayStart = timeToMinutes(times[0]);
  const minute = dayStart + rowIndex * slotStepMin;
  return { date, minute };
}

function calendarStatusKey(status: string): string {
  if (status === 'SCHEDULED') return 'appointmentsPage.statusCalendar.ARRIVED';
  if (status === 'WAITING') return 'appointmentsPage.statusCalendar.WAITING';
  if (status === 'IN_TREATMENT') return 'appointmentsPage.statusCalendar.IN_TREATMENT';
  if (status === 'CANCELLED') return 'appointmentsPage.statusCalendar.CANCELLED';
  if (status === 'COMPLETED') return 'appointmentsPage.status.COMPLETED';
  return `appointmentsPage.status.${status}`;
}

function AppointmentCardContent({
  appt,
  previewMinute,
  previewDuration,
  language,
  t,
}: {
  appt: AppointmentWithPatient;
  previewMinute: number;
  previewDuration: number;
  language: string;
  t: (key: string) => string;
}) {
  const endMin = previewMinute + previewDuration;
  return (
    <>
      <span className="appointment-card__time">
        {formatClockTime(minutesToTime(previewMinute), language)} –{' '}
        {formatClockTime(minutesToTime(endMin), language)}
      </span>
      <span className="appointment-card__patient">
        {appt.patientName}
        {!appt.patientId && (
          <span className="appointment-card__guest-tag">{t('appointmentsPage.walkin.tag')}</span>
        )}
      </span>
      {appt.status !== 'SCHEDULED' && (
        <span className={`appointment-card__status appointment-card__status--${appt.status.toLowerCase()}`}>
          {t(calendarStatusKey(appt.status))}
        </span>
      )}
    </>
  );
}

export function WeekCalendar({
  dayColumns,
  times,
  slotStepMin,
  rowHeightPx,
  language,
  isRtl = false,
  focusDate,
  canCreate,
  canEdit,
  selectedSlot,
  draggingEmergency,
  onSlotSelect,
  onAppointmentOpen,
  onAppointmentMove,
  onDragWeekShift,
  onEmergencyDrop,
  onEmergencyDragEnd,
  isUpdating,
}: WeekCalendarProps) {
  const { t } = useTranslation();
  const isMobileWeek = useMediaQuery(CALENDAR_MOBILE_BREAKPOINT);
  const minCardHeightPx = isMobileWeek ? CALENDAR_MOBILE_MIN_CARD_HEIGHT_PX : CALENDAR_MIN_CARD_HEIGHT_PX;
  const timeColumnPx = isMobileWeek ? CALENDAR_MOBILE_TIME_COLUMN_PX : CALENDAR_TIME_COLUMN_PX;
  const dayColumnTemplate = 'repeat(7, minmax(0, 1fr))';
  const [drag, setDrag] = useState<ApptDragState | null>(null);
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60;
  });
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingDragRef = useRef<PendingApptDrag | null>(null);
  const pendingListenersRef = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void } | null>(null);
  const weekShiftLatchRef = useRef(false);
  const weekShiftLandingRef = useRef<string | null>(null);
  const dragRef = useRef<ApptDragState | null>(null);
  const finishApptDragRef = useRef<(state: ApptDragState) => void>(() => undefined);
  const onDragWeekShiftRef = useRef(onDragWeekShift);
  const dayColumnsRef = useRef(dayColumns);
  const dayIsosRef = useRef(dayColumns.map((d) => d.iso));
  const timesRef = useRef(times);
  const isRtlRef = useRef(isRtl);
  dayColumnsRef.current = dayColumns;
  dayIsosRef.current = dayColumns.map((d) => d.iso);
  timesRef.current = times;
  isRtlRef.current = isRtl;
  onDragWeekShiftRef.current = onDragWeekShift;
  dragRef.current = drag;
  const dayIsos = dayColumns.map((d) => d.iso);
  const isDragging = drag !== null;
  const weekKey = dayColumns[0]?.iso ?? '';

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60);
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const scrollToDayColumn = useCallback(
    (iso: string, behavior: ScrollBehavior = 'smooth') => {
      const scrollEl = scrollRef.current;
      if (!scrollEl || !isMobileWeek) return;
      const idx = dayColumns.findIndex((d) => d.iso === iso);
      if (idx < 0) return;
      const dayWidth = Math.max(1, (scrollEl.clientWidth - timeColumnPx) / 7);
      const offset = timeColumnPx + idx * dayWidth;
      const centered = offset - (scrollEl.clientWidth - dayWidth) / 2 + timeColumnPx / 2;
      scrollEl.scrollTo({ left: Math.max(0, centered), behavior });
    },
    [dayColumns, isMobileWeek, timeColumnPx],
  );

  useEffect(() => {
    if (!isMobileWeek || !weekKey) return;
    const targetDay = dayColumns.find((d) => d.isToday) ?? dayColumns[0];
    if (!targetDay) return;
    scrollToDayColumn(targetDay.iso, 'auto');
  }, [dayColumns, isMobileWeek, scrollToDayColumn, weekKey]);

  const clearPendingDrag = useCallback(() => {
    if (pendingListenersRef.current) {
      document.removeEventListener('mousemove', pendingListenersRef.current.move);
      document.removeEventListener('mouseup', pendingListenersRef.current.up);
      pendingListenersRef.current = null;
    }
    pendingDragRef.current = null;
  }, []);

  useEffect(() => () => clearPendingDrag(), [clearPendingDrag]);

  const finishApptDrag = useCallback(
    (state: ApptDragState) => {
      const newTime = minutesToTime(state.previewMinute);
      const durationMin = state.appt.durationMin || DEFAULT_DURATION;
      const unchanged = newTime === state.appt.time && state.previewDate === state.appt.date;
      if (unchanged) return;
      if (
        !state.dropValid ||
        !canPlaceAt(dayColumns, state.previewDate, state.previewMinute, durationMin, state.appt.id)
      ) {
        return;
      }
      onAppointmentMove(state.appt, state.previewDate, newTime);
    },
    [dayColumns, onAppointmentMove],
  );
  finishApptDragRef.current = finishApptDrag;

  useEffect(() => {
    if (!isDragging) return;

    const minuteAtPointer = (clientY: number, gridEl: HTMLDivElement, timesNow: string[]) => {
      const gridRect = gridEl.getBoundingClientRect();
      const dayStart = timesNow.length > 0 ? timeToMinutes(timesNow[0]) : 0;
      const relativeY = Math.max(0, clientY - (gridRect.top + CALENDAR_HEADER_ROW_PX));
      const rowIndex = Math.min(timesNow.length - 1, Math.floor(relativeY / rowHeightPx));
      return dayStart + rowIndex * slotStepMin;
    };

    const handleMove = (e: MouseEvent) => {
      const dayColumnsNow = dayColumnsRef.current;
      const dayIsosNow = dayIsosRef.current;
      const timesNow = timesRef.current;
      const gridEl = gridRef.current;

      let target = resolveDropTarget(
        e.clientX,
        e.clientY,
        timesNow,
        slotStepMin,
        rowHeightPx,
        gridEl,
        dayIsosNow,
        isRtlRef.current,
      );

      const EDGE_PX = 28;
      if (gridEl && dayIsosNow.length > 0 && onDragWeekShiftRef.current) {
        const gridRect = gridEl.getBoundingClientRect();
        const cornerEl = gridEl.querySelector('.week-agenda__corner');
        const timeColWidth = cornerEl?.getBoundingClientRect().width ?? CALENDAR_TIME_COLUMN_PX;
        const gridLeft = gridRect.left + timeColWidth;
        const gridRight = gridRect.right;
        const lastDay = dayIsosNow[dayIsosNow.length - 1];
        const firstDay = dayIsosNow[0];
        const atForwardEdge = isRtlRef.current
          ? e.clientX < gridLeft + EDGE_PX
          : e.clientX > gridRight - EDGE_PX;
        const atBackwardEdge = isRtlRef.current
          ? e.clientX > gridRight - EDGE_PX
          : e.clientX < gridLeft + EDGE_PX;

        if (!weekShiftLatchRef.current && atForwardEdge) {
          weekShiftLatchRef.current = true;
          const nextMonday = localAddDaysIso(lastDay, 1);
          weekShiftLandingRef.current = nextMonday;
          onDragWeekShiftRef.current(1);
          target = { date: nextMonday, minute: minuteAtPointer(e.clientY, gridEl, timesNow) };
        } else if (!weekShiftLatchRef.current && atBackwardEdge) {
          weekShiftLatchRef.current = true;
          const prevSunday = localAddDaysIso(firstDay, -1);
          weekShiftLandingRef.current = prevSunday;
          onDragWeekShiftRef.current(-1);
          target = { date: prevSunday, minute: minuteAtPointer(e.clientY, gridEl, timesNow) };
        } else if (weekShiftLatchRef.current && (atForwardEdge || atBackwardEdge) && weekShiftLandingRef.current) {
          target = { date: weekShiftLandingRef.current, minute: minuteAtPointer(e.clientY, gridEl, timesNow) };
        }
      }

      setDrag((prev) => {
        if (!prev) return prev;
        if (!target) {
          return { ...prev, pointerX: e.clientX, pointerY: e.clientY, dropValid: false };
        }
        const durationMin = prev.appt.durationMin || DEFAULT_DURATION;
        const valid = canPlaceAt(dayColumnsNow, target.date, target.minute, durationMin, prev.appt.id);
        if (!valid) {
          return { ...prev, pointerX: e.clientX, pointerY: e.clientY, dropValid: false };
        }
        return {
          ...prev,
          previewDate: target.date,
          previewMinute: target.minute,
          pointerX: e.clientX,
          pointerY: e.clientY,
          dropValid: true,
        };
      });
    };

    const handleUp = () => {
      weekShiftLatchRef.current = false;
      weekShiftLandingRef.current = null;
      const current = dragRef.current;
      if (current) finishApptDragRef.current(current);
      setDrag(null);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, rowHeightPx, slotStepMin]);

  useEffect(() => {
    if (!draggingEmergency) return;

    const handleUp = (e: MouseEvent) => {
      const dayColumnsNow = dayColumnsRef.current;
      const dayIsosNow = dayIsosRef.current;
      const timesNow = timesRef.current;
      const target = resolveDropTarget(
        e.clientX,
        e.clientY,
        timesNow,
        slotStepMin,
        rowHeightPx,
        gridRef.current,
        dayIsosNow,
        isRtlRef.current,
      );
      if (target) {
        const durationMin = draggingEmergency.durationMin || DEFAULT_DURATION;
        if (canPlaceAt(dayColumnsNow, target.date, target.minute, durationMin, draggingEmergency.id)) {
          onEmergencyDrop(draggingEmergency, target.date, minutesToTime(target.minute));
        }
      }
      onEmergencyDragEnd();
    };

    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mouseup', handleUp);
    };
  }, [draggingEmergency, onEmergencyDragEnd, onEmergencyDrop, rowHeightPx, slotStepMin]);

  function beginAppointmentPointer(e: React.MouseEvent, appt: AppointmentWithPatient, date: string) {
    if (!canEdit || isUpdating) return;
    e.stopPropagation();

    clearPendingDrag();
    pendingDragRef.current = { appt, date, startX: e.clientX, startY: e.clientY };

    const onMove = (ev: MouseEvent) => {
      const pending = pendingDragRef.current;
      if (!pending) return;
      const dx = ev.clientX - pending.startX;
      const dy = ev.clientY - pending.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

      const { appt: dragAppt, date: dragDate } = pending;
      clearPendingDrag();
      weekShiftLatchRef.current = false;
      setDrag({
        appt: dragAppt,
        originDate: dragDate,
        originMinute: timeToMinutes(dragAppt.time),
        previewDate: dragDate,
        previewMinute: timeToMinutes(dragAppt.time),
        pointerX: ev.clientX,
        pointerY: ev.clientY,
        dropValid: true,
      });
    };

    const onUp = () => {
      const pending = pendingDragRef.current;
      clearPendingDrag();
      if (pending) {
        onAppointmentOpen(pending.appt);
      }
    };

    pendingListenersRef.current = { move: onMove, up: onUp };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function handleAppointmentClick(appt: AppointmentWithPatient) {
    onAppointmentOpen(appt);
  }

  function handleSlotClick(date: string, time: string, appt: AppointmentWithPatient | undefined) {
    if (appt) {
      handleAppointmentClick(appt);
      return;
    }
    if (!canCreate) return;
    onSlotSelect(date, time);
  }

  const draggingId = drag?.appt.id;
  const dropHighlight = draggingEmergency !== null || drag !== null;

  const dropHint =
    drag &&
    (drag.dropValid
      ? `${new Date(`${drag.previewDate}T12:00:00`).toLocaleDateString(language, { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatClockTime(minutesToTime(drag.previewMinute), language)}`
      : t('appointmentsPage.overlapBlocked'));

  return (
    <div
      className={[
        'week-agenda',
        dropHighlight ? 'week-agenda--drop-target' : '',
        isMobileWeek ? 'week-agenda--mobile-week' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      ref={gridRef}
    >
      {drag && dropHint && (
        <div
          className={`week-agenda__drop-hint${drag.dropValid ? '' : ' week-agenda__drop-hint--invalid'}`}
          style={{ left: drag.pointerX + 14, top: drag.pointerY + 14 }}
        >
          {dropHint}
        </div>
      )}

      {isMobileWeek && (
        <div className="week-agenda__mobile-strip" aria-label={t('appointmentsPage.weekView') ?? 'Week view'}>
          {dayColumns.map((d) => {
            const dateObj = new Date(`${d.iso}T12:00:00`);
            return (
              <button
                key={d.iso}
                type="button"
                className={[
                  'week-agenda__mobile-day',
                  d.isToday ? 'week-agenda__mobile-day--today' : '',
                  d.iso === focusDate ? 'week-agenda__mobile-day--focused' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => scrollToDayColumn(d.iso)}
              >
                <span className="week-agenda__mobile-day-name">
                  {dateObj.toLocaleDateString(language, { weekday: 'short' })}
                </span>
                <span className="week-agenda__mobile-day-number">
                  {dateObj.toLocaleDateString(language, { day: 'numeric', month: 'short' })}
                </span>
                {d.isToday && <span className="week-agenda__mobile-day-today">{t('common.today')}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="week-agenda__scroll" ref={scrollRef}>
        <div
          className="week-agenda__grid"
          style={{
            gridTemplateColumns: `${timeColumnPx}px ${dayColumnTemplate}`,
            gridTemplateRows: `${CALENDAR_HEADER_ROW_PX}px repeat(${times.length}, ${rowHeightPx}px)`,
          }}
        >
          <div className="week-agenda__corner" style={{ gridRow: 1, gridColumn: 1 }} />

          {dayColumns.map((d, dayIdx) => {
            const closed = isDayClosed(d.schedule);
            const exceptionNote = d.schedule?.exceptionNote;
            const isFocused = d.iso === focusDate;
            const isDropDay = drag?.previewDate === d.iso;
            return (
              <div
                key={d.iso}
                style={{ gridRow: 1, gridColumn: dayIdx + 2 }}
                className={[
                  'week-agenda__day-header',
                  d.isToday ? 'week-agenda__day-header--today' : '',
                  isFocused ? 'week-agenda__day-header--focused' : '',
                  isDropDay && drag ? 'week-agenda__day-header--drop-target' : '',
                  closed ? 'week-agenda__day-header--closed' : '',
                  d.schedule?.isException ? 'week-agenda__day-header--exception' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="week-agenda__day-name">
                  {new Date(`${d.iso}T12:00:00`).toLocaleDateString(language, { weekday: 'short' })}
                </span>
                <span className="week-agenda__day-number">
                  {new Date(`${d.iso}T12:00:00`).toLocaleDateString(language, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {d.isToday && isMobileWeek && (
                  <span className="week-agenda__today-badge">{t('common.today')}</span>
                )}
                {closed && <span className="week-agenda__closed-tag">{t('appointmentsPage.closedDay')}</span>}
                {exceptionNote && <span className="week-agenda__exception-note">{exceptionNote}</span>}
              </div>
            );
          })}

          {times.map((time, rowIdx) => (
            <div
              key={`label-${time}`}
              style={{ gridRow: rowIdx + 2, gridColumn: 1 }}
              className="week-agenda__time-label"
            >
              {formatClockTime(time, language)}
            </div>
          ))}

          {dayColumns.map((d, dayIdx) => {
            const closed = isDayClosed(d.schedule);
            const appointments = (d.schedule?.appointments ?? []).filter(
              (a) => !isEmergencyAppointment(a) && a.status !== 'CANCELLED',
            );
            const slotMap = new Map((d.schedule?.slots ?? []).map((s) => [s.time, s]));
            const dayStartMin = times.length > 0 ? timeToMinutes(times[0]) : 0;
            const clickable = !closed && (canCreate || canEdit);
            const isFocused = d.iso === focusDate;
            const isDropDay = drag?.previewDate === d.iso;

            return (
              <div
                key={`${d.iso}-body`}
                data-day-iso={d.iso}
                style={{ gridRow: `2 / span ${times.length}`, gridColumn: dayIdx + 2 }}
                className={[
                  'week-agenda__day-body',
                  d.isToday ? 'week-agenda__day-body--today' : '',
                  isFocused ? 'week-agenda__day-body--focused' : '',
                  isDropDay && drag ? 'week-agenda__day-body--drop-target' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {d.isToday &&
                  times.length > 0 &&
                  nowMin >= dayStartMin &&
                  nowMin <= dayStartMin + times.length * slotStepMin && (
                    <div
                      className="week-agenda__now-line"
                      style={{ top: ((nowMin - dayStartMin) / slotStepMin) * rowHeightPx }}
                      aria-hidden="true"
                    />
                  )}
                {times.map((time, rowIdx) => {
                  const covering = findCoveringAppointment(appointments, time, slotStepMin);
                  const withinHours = slotMap.get(time)?.withinWorkingHours ?? true;
                  const outsideHours = !closed && !withinHours;
                  const selected = selectedSlot?.date === d.iso && selectedSlot.time === time;
                  const isDropSlot =
                    drag?.dropValid &&
                    drag.previewDate === d.iso &&
                    timeToMinutes(time) === drag.previewMinute;

                  return (
                    <div
                      key={time}
                      className={[
                        'week-agenda__slot',
                        covering && !(draggingId === covering.id)
                          ? 'week-agenda__slot--covered'
                          : 'week-agenda__slot--free',
                        closed && !covering ? 'week-agenda__slot--closed' : '',
                        outsideHours && !covering ? 'week-agenda__slot--outside-hours' : '',
                        withinHours && !closed && !covering ? 'week-agenda__slot--working-hours' : '',
                        selected ? 'week-agenda__slot--selected' : '',
                        isDropSlot ? 'week-agenda__slot--drop-target' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{ top: rowIdx * rowHeightPx, height: rowHeightPx }}
                      onClick={() => {
                        if (!clickable) return;
                        const exact = findCoveringAppointment(appointments, time, slotStepMin);
                        handleSlotClick(d.iso, time, exact);
                      }}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                    />
                  );
                })}

                {appointments.map((appt) => {
                  const isDragging = draggingId === appt.id;
                  if (isDragging) return null;

                  const previewDuration = appt.durationMin || DEFAULT_DURATION;
                  const top = ((timeToMinutes(appt.time) - dayStartMin) / slotStepMin) * rowHeightPx;
                  const height = Math.max(minCardHeightPx, (previewDuration / slotStepMin) * rowHeightPx - 2);

                  return (
                    <div
                      key={appt.id}
                      className={[
                        'appointment-card',
                        `appointment-card--${appt.status.toLowerCase()}`,
                        previewDuration <= slotStepMin ? 'appointment-card--short' : '',
                        appt.outsideWorkingHours ? 'appointment-card--outside-hours' : '',
                        canEdit ? 'appointment-card--draggable' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{ top, height }}
                      onMouseDown={canEdit ? (e) => beginAppointmentPointer(e, appt, d.iso) : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canEdit) handleAppointmentClick(appt);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <AppointmentCardContent
                        appt={appt}
                        previewMinute={timeToMinutes(appt.time)}
                        previewDuration={previewDuration}
                        language={language}
                        t={t}
                      />
                    </div>
                  );
                })}

                {drag &&
                  drag.previewDate === d.iso &&
                  (() => {
                    const appt = drag.appt;
                    const previewDuration = appt.durationMin || DEFAULT_DURATION;
                    const top = ((drag.previewMinute - dayStartMin) / slotStepMin) * rowHeightPx;
                    const height = Math.max(minCardHeightPx, (previewDuration / slotStepMin) * rowHeightPx - 2);
                    return (
                      <div
                        key={`drag-preview-${appt.id}`}
                        className={[
                          'appointment-card',
                          'appointment-card--drag-preview',
                          drag.dropValid ? '' : 'appointment-card--drag-preview-invalid',
                          `appointment-card--${appt.status.toLowerCase()}`,
                          previewDuration <= slotStepMin ? 'appointment-card--short' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{ top, height }}
                      >
                        <AppointmentCardContent
                          appt={appt}
                          previewMinute={drag.previewMinute}
                          previewDuration={previewDuration}
                          language={language}
                          t={t}
                        />
                      </div>
                    );
                  })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
