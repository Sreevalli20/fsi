import React from 'react';
import { Appointment } from '@/types/appointment';
import { StatusBadge } from './StatusBadge';
import { formatTimeDisplay, formatDateDisplay } from '@/lib/appointments';
import { Calendar, Clock, Edit2, CheckCircle, XCircle, Repeat } from 'lucide-react';

interface AppointmentCardProps {
  appointment: Appointment;
  onEdit: (appointment: Appointment) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
}

export function AppointmentCard({
  appointment,
  onEdit,
  onComplete,
  onCancel,
}: AppointmentCardProps) {
  const isCancelled = appointment.status === 'Cancelled';
  const isCompleted = appointment.status === 'Completed';
  const isScheduled = appointment.status === 'Scheduled';

  return (
    <div
      id={`appointment-card-${appointment.id}`}
      className={`relative rounded-2xl border p-5 transition-all duration-200 ${
        isCancelled
          ? 'bg-stone-900/50 border-stone-800/80 text-stone-500 opacity-75'
          : isCompleted
          ? 'bg-stone-900 border-stone-800 hover:border-emerald-500/30 hover:shadow-lg'
          : 'bg-stone-900 border-stone-800 hover:border-stone-700 hover:shadow-lg'
      }`}
    >
      {/* Top Header: Title + Status & Recurrence Badges */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <h3
          className={`font-semibold text-base leading-snug tracking-tight ${
            isCancelled
              ? 'text-stone-500 line-through decoration-stone-600'
              : 'text-stone-100'
          }`}
        >
          {appointment.title}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {appointment.recurrence_pattern && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-stone-800 text-amber-400 border border-amber-500/30 capitalize"
              title={`Recurring ${appointment.recurrence_pattern}`}
            >
              <Repeat size={11} />
              <span>{appointment.recurrence_pattern}</span>
            </span>
          )}
          <StatusBadge status={appointment.status} />
        </div>
      </div>

      {/* Description */}
      {appointment.description && (
        <p
          className={`text-xs mb-4 leading-relaxed line-clamp-2 ${
            isCancelled ? 'text-stone-500' : 'text-stone-400'
          }`}
        >
          {appointment.description}
        </p>
      )}

      {/* Meta Information: Date and Time Slot */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-stone-400 pt-3 border-t border-stone-800/80 mb-4">
        <div className="flex items-center gap-1.5 font-medium">
          <Calendar size={14} className={isCancelled ? 'text-stone-600' : 'text-stone-400'} />
          <span>{formatDateDisplay(appointment.appointment_date)}</span>
        </div>

        <div className="flex items-center gap-1.5 font-medium">
          <Clock size={14} className={isCancelled ? 'text-stone-600' : 'text-stone-400'} />
          <span>
            {formatTimeDisplay(appointment.start_time)} – {formatTimeDisplay(appointment.end_time)}
          </span>
        </div>
      </div>

      {/* Actions Toolbar */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-[11px] text-stone-500">
          {isCancelled && <span className="italic text-stone-500">Slot freed for booking</span>}
        </div>

        <div className="flex items-center gap-2">
          {/* Complete button (only for scheduled) */}
          {isScheduled && (
            <button
              id={`btn-complete-${appointment.id}`}
              type="button"
              onClick={() => onComplete(appointment.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/60 rounded-xl border border-emerald-500/30 transition-colors cursor-pointer"
              title="Mark as Completed"
            >
              <CheckCircle size={13} />
              <span>Complete</span>
            </button>
          )}

          {/* Cancel button (only for scheduled) */}
          {isScheduled && (
            <button
              id={`btn-cancel-${appointment.id}`}
              type="button"
              onClick={() => onCancel(appointment.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-400 bg-rose-950/60 hover:bg-rose-900/60 rounded-xl border border-rose-500/30 transition-colors cursor-pointer"
              title="Cancel appointment and free slot"
            >
              <XCircle size={13} />
              <span>Cancel</span>
            </button>
          )}

          {/* Edit button */}
          <button
            id={`btn-edit-${appointment.id}`}
            type="button"
            onClick={() => onEdit(appointment)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-300 bg-stone-800 hover:bg-stone-700/80 rounded-xl border border-stone-700/80 transition-colors cursor-pointer"
            title="Edit details"
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
