'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Appointment } from '@/types/appointment';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Ban,
  Repeat,
  Sparkles,
} from 'lucide-react';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  appointment: Appointment;
}

interface CalendarViewProps {
  appointments: Appointment[];
  onSelectAppointment: (appointment: Appointment) => void;
  onCreateAppointmentAt: (dateStr: string, timeStr?: string) => void;
  selectedDate?: string;
}

export function CalendarView({
  appointments,
  onSelectAppointment,
  onCreateAppointmentAt,
  selectedDate,
}: CalendarViewProps) {
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (selectedDate) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });

  // When selectedDate prop changes, center calendar
  React.useEffect(() => {
    if (selectedDate) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      setCurrentDate(new Date(y, m - 1, d));
    }
  }, [selectedDate]);

  // Convert appointments to calendar events
  const events = useMemo<CalendarEvent[]>(() => {
    return appointments.map((appt) => {
      const [year, month, day] = appt.appointment_date.split('-').map(Number);
      const [sHour, sMin] = appt.start_time.split(':').map(Number);
      const [eHour, eMin] = appt.end_time.split(':').map(Number);

      const start = new Date(year, month - 1, day, sHour, sMin, 0);
      const end = new Date(year, month - 1, day, eHour, eMin, 0);

      return {
        id: appt.id,
        title: appt.title,
        start,
        end,
        appointment: appt,
      };
    });
  }, [appointments]);

  // Custom Event component
  const CustomEvent = useCallback(({ event }: { event: CalendarEvent }) => {
    const { appointment } = event;
    const isCompleted = appointment.status === 'Completed';
    const isCancelled = appointment.status === 'Cancelled';

    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium truncate w-full h-full">
        {isCompleted ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : isCancelled ? (
          <Ban className="w-3.5 h-3.5 text-stone-500 shrink-0" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        )}
        <span className={`truncate ${isCancelled ? 'line-through opacity-70 text-stone-400' : 'text-stone-100'}`}>
          {appointment.title}
        </span>
        {appointment.recurrence_pattern && (
          <Repeat className="w-3 h-3 text-stone-400 shrink-0 ml-auto" />
        )}
      </div>
    );
  }, []);

  // Event styling based on appointment status
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const { status } = event.appointment;
    if (status === 'Completed') {
      return {
        className: 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-100 rounded-lg shadow-xs hover:border-emerald-400 transition-colors',
      };
    }
    if (status === 'Cancelled') {
      return {
        className: 'bg-stone-900/90 border border-stone-800 text-stone-400 rounded-lg opacity-60 hover:opacity-100 transition-opacity',
      };
    }
    // Scheduled
    return {
      className: 'bg-stone-800 border border-amber-500/40 text-stone-100 rounded-lg shadow-xs hover:border-amber-400 transition-colors',
    };
  }, []);

  const handleSelectSlot = useCallback(
    ({ start }: { start: Date }) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      const timeStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      onCreateAppointmentAt(dateStr, timeStr);
    },
    [onCreateAppointmentAt]
  );

  const handleNavigate = (action: 'PREV' | 'TODAY' | 'NEXT') => {
    const next = new Date(currentDate);
    if (action === 'TODAY') {
      setCurrentDate(new Date());
      return;
    }

    const step = action === 'NEXT' ? 1 : -1;
    if (currentView === Views.MONTH) {
      next.setMonth(next.getMonth() + step);
    } else if (currentView === Views.WEEK) {
      next.setDate(next.getDate() + step * 7);
    } else if (currentView === Views.DAY) {
      next.setDate(next.getDate() + step);
    } else {
      next.setMonth(next.getMonth() + step);
    }
    setCurrentDate(next);
  };

  const headerTitle = useMemo(() => {
    if (currentView === Views.MONTH) {
      return format(currentDate, 'MMMM yyyy');
    }
    if (currentView === Views.WEEK) {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    if (currentView === Views.DAY) {
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    }
    return format(currentDate, 'MMMM yyyy');
  }, [currentDate, currentView]);

  return (
    <div id="calendar-view-container" className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl p-4 sm:p-6 text-stone-100">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-stone-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-stone-950 border border-stone-800 rounded-xl p-1 shadow-inner">
            <button
              id="calendar-nav-prev"
              type="button"
              onClick={() => handleNavigate('PREV')}
              className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              id="calendar-nav-today"
              type="button"
              onClick={() => handleNavigate('TODAY')}
              className="px-2.5 py-1 text-xs font-semibold text-stone-300 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              id="calendar-nav-next"
              type="button"
              onClick={() => handleNavigate('NEXT')}
              className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h3 id="calendar-header-title" className="text-base sm:text-lg font-semibold tracking-tight text-stone-100">
            {headerTitle}
          </h3>
        </div>

        {/* View Switcher: Month, Week, Day, Agenda */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex p-1 bg-stone-950 border border-stone-800 rounded-xl">
            {(
              [
                { id: Views.MONTH, label: 'Month' },
                { id: Views.WEEK, label: 'Week' },
                { id: Views.DAY, label: 'Day' },
                { id: Views.AGENDA, label: 'Agenda' },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                id={`calendar-view-${v.label.toLowerCase()}`}
                type="button"
                onClick={() => setCurrentView(v.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  currentView === v.id
                    ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Grid with react-big-calendar */}
      <div className="mt-4 appointment-calendar-wrapper h-[640px] sm:h-[700px]">
        <Calendar
          localizer={localizer}
          events={events}
          view={currentView}
          onView={(view) => setCurrentView(view)}
          date={currentDate}
          onNavigate={(date) => setCurrentDate(date)}
          startAccessor="start"
          endAccessor="end"
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={(event) => onSelectAppointment(event.appointment)}
          components={{
            event: CustomEvent,
          }}
          eventPropGetter={eventPropGetter}
          toolbar={false} // We have custom controls above
          step={30}
          timeslots={2}
          defaultView={Views.MONTH}
        />
      </div>

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-stone-800/80 text-xs text-stone-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500/40" />
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-500/40" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-600 border border-stone-500" />
            <span>Cancelled</span>
          </div>
        </div>
        <p className="text-[11px] text-stone-500">
          Tip: Click any time slot to schedule or click an appointment to edit
        </p>
      </div>
    </div>
  );
}
