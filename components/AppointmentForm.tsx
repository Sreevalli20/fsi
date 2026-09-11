import React, { useState, useEffect, useMemo } from 'react';
import { Appointment, AppointmentFormData, AppointmentStatus, RecurrencePattern } from '@/types/appointment';
import { checkTimeConflict, normalizeTime, formatDateDisplay } from '@/lib/appointments';
import { X, AlertCircle, Clock, Calendar, CheckCircle, Repeat, CalendarDays, Info } from 'lucide-react';

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: AppointmentFormData) => Promise<{ success: boolean; error?: string }>;
  initialAppointment?: Appointment | null;
  existingAppointments: Appointment[];
  prefilledDate?: string;
  prefilledTime?: string;
}

export function AppointmentForm({
  isOpen,
  onClose,
  onSubmit,
  initialAppointment,
  existingAppointments,
  prefilledDate,
  prefilledTime,
}: AppointmentFormProps) {
  const isEditing = Boolean(initialAppointment);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [status, setStatus] = useState<AppointmentStatus>('Scheduled');

  // Recurrence states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('weekly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form state
  useEffect(() => {
    if (initialAppointment) {
      setTitle(initialAppointment.title);
      setDescription(initialAppointment.description || '');
      setDate(initialAppointment.appointment_date);
      setStartTime(normalizeTime(initialAppointment.start_time));
      setEndTime(normalizeTime(initialAppointment.end_time));
      setStatus(initialAppointment.status);
      setIsRecurring(Boolean(initialAppointment.recurrence_pattern));
      setRecurrencePattern(initialAppointment.recurrence_pattern || 'weekly');
      setRecurrenceEndDate(initialAppointment.recurrence_end_date || '');
    } else {
      // Default date from prefilled or today
      const today = new Date().toISOString().split('T')[0];
      const selectedDate = prefilledDate || today;
      setTitle('');
      setDescription('');
      setDate(selectedDate);
      setStartTime(prefilledTime ? normalizeTime(prefilledTime) : '10:00');
      
      // End time + 1 hour
      if (prefilledTime) {
        const [h, m] = prefilledTime.split(':').map(Number);
        const endH = (h + 1).toString().padStart(2, '0');
        setEndTime(`${endH}:${(m || 0).toString().padStart(2, '0')}`);
      } else {
        setEndTime('11:00');
      }
      
      setStatus('Scheduled');
      setIsRecurring(false);
      setRecurrencePattern('weekly');

      // Default recurrence end date: 6 weeks from selected date
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 42);
      setRecurrenceEndDate(d.toISOString().split('T')[0]);
    }
    setErrors({});
    setServerError(null);
  }, [initialAppointment, isOpen, prefilledDate, prefilledTime]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Real-time conflict preview for the primary date
  const liveConflict = useMemo(() => {
    if (!date || !startTime || !endTime) return null;
    if (endTime <= startTime) return null;
    if (status === 'Cancelled') return null;

    const result = checkTimeConflict(
      existingAppointments,
      date,
      startTime,
      endTime,
      initialAppointment?.id
    );

    return result.hasConflict ? result : null;
  }, [existingAppointments, date, startTime, endTime, status, initialAppointment?.id]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required.';
    }

    if (!date) {
      newErrors.date = 'Date is required.';
    }

    if (!startTime) {
      newErrors.startTime = 'Start time is required.';
    }

    if (!endTime) {
      newErrors.endTime = 'End time is required.';
    } else if (startTime && endTime <= startTime) {
      newErrors.endTime = 'End time must be later than start time.';
    }

    if (isRecurring && !isEditing) {
      if (!recurrenceEndDate) {
        newErrors.recurrenceEndDate = 'Recurrence end date is required.';
      } else if (recurrenceEndDate < date) {
        newErrors.recurrenceEndDate = 'End date cannot be earlier than appointment date.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: AppointmentFormData = {
        title: title.trim(),
        description: description.trim() || undefined,
        appointment_date: date,
        start_time: startTime,
        end_time: endTime,
        status,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : undefined,
        recurrence_end_date: isRecurring ? recurrenceEndDate : undefined,
      };

      const res = await onSubmit(payload);
      if (!res.success) {
        setServerError(res.error || 'Failed to save appointment. Please check for scheduling conflicts.');
      } else {
        onClose();
      }
    } catch (err: any) {
      setServerError(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="appointment-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="appointment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-stone-100"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/70 shrink-0">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-stone-100">
              {isEditing ? 'Edit Appointment' : 'Create Appointment'}
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {isEditing
                ? 'Update timing or details. Conflicts will be verified automatically.'
                : 'Schedule a single or recurring appointment with strict conflict prevention.'}
            </p>
          </div>
          <button
            id="btn-close-modal"
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Server Error Alert */}
          {serverError && (
            <div
              id="server-error-banner"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium"
            >
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Real-time Conflict Warning */}
          {liveConflict && (
            <div
              id="conflict-warning-banner"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium"
            >
              <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">Scheduling Conflict Detected</p>
                <p className="text-amber-300/90">{liveConflict.message}</p>
              </div>
            </div>
          )}

          {/* Title Field */}
          <div>
            <label htmlFor="appointment-title" className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
              Title <span className="text-amber-500">*</span>
            </label>
            <input
              id="appointment-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
              }}
              placeholder="e.g., Weekly Product Sync or Client Consultation"
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-stone-950 text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-2 transition-colors ${
                errors.title
                  ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-stone-800 focus:border-amber-500/60 focus:ring-amber-500/20'
              }`}
            />
            {errors.title && (
              <p id="error-title" className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 font-medium">
                <AlertCircle size={12} /> {errors.title}
              </p>
            )}
          </div>

          {/* Date Field */}
          <div>
            <label htmlFor="appointment-date" className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
              Appointment Date <span className="text-amber-500">*</span>
            </label>
            <div className="relative">
              <input
                id="appointment-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
                  // Update recurrence end date recommendation if recurring
                  if (isRecurring) {
                    const d = new Date(e.target.value);
                    d.setDate(d.getDate() + 42);
                    setRecurrenceEndDate(d.toISOString().split('T')[0]);
                  }
                }}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 transition-colors ${
                  errors.date
                    ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-stone-800 focus:border-amber-500/60 focus:ring-amber-500/20'
                }`}
              />
            </div>
            {errors.date && (
              <p id="error-date" className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 font-medium">
                <AlertCircle size={12} /> {errors.date}
              </p>
            )}
          </div>

          {/* Time Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Time */}
            <div>
              <label htmlFor="appointment-start-time" className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Start Time <span className="text-amber-500">*</span>
              </label>
              <input
                id="appointment-start-time"
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  if (errors.startTime || errors.endTime) {
                    setErrors((prev) => ({ ...prev, startTime: '', endTime: '' }));
                  }
                }}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 transition-colors ${
                  errors.startTime
                    ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-stone-800 focus:border-amber-500/60 focus:ring-amber-500/20'
                }`}
              />
              {errors.startTime && (
                <p id="error-start-time" className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 font-medium">
                  <AlertCircle size={12} /> {errors.startTime}
                </p>
              )}
            </div>

            {/* End Time */}
            <div>
              <label htmlFor="appointment-end-time" className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                End Time <span className="text-amber-500">*</span>
              </label>
              <input
                id="appointment-end-time"
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  if (errors.endTime) setErrors((prev) => ({ ...prev, endTime: '' }));
                }}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl border bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 transition-colors ${
                  errors.endTime
                    ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-stone-800 focus:border-amber-500/60 focus:ring-amber-500/20'
                }`}
              />
              {errors.endTime && (
                <p id="error-end-time" className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 font-medium">
                  <AlertCircle size={12} /> {errors.endTime}
                </p>
              )}
            </div>
          </div>

          {/* Status Selection (when editing) */}
          {isEditing && (
            <div>
              <label htmlFor="appointment-status-select" className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                id="appointment-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-800 bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 focus:border-amber-500/60 focus:ring-amber-500/20"
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled (Frees up time slot)</option>
              </select>
            </div>
          )}

          {/* Recurrence Option (when creating new appointment) */}
          {!isEditing && (
            <div className="p-4 rounded-xl border border-stone-800 bg-stone-950/60 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <label htmlFor="checkbox-is-recurring" className="text-xs font-semibold text-stone-200 cursor-pointer">
                      Repeat Appointment
                    </label>
                    <p className="text-[11px] text-stone-500">
                      Create multiple occurrences with conflict checking
                    </p>
                  </div>
                </div>
                <input
                  id="checkbox-is-recurring"
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-stone-700 bg-stone-900 cursor-pointer"
                />
              </div>

              {isRecurring && (
                <div className="pt-3 border-t border-stone-800/80 space-y-3 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="recurrence-pattern" className="block text-xs font-medium text-stone-300 mb-1">
                        Recurrence Frequency
                      </label>
                      <select
                        id="recurrence-pattern"
                        value={recurrencePattern}
                        onChange={(e) => setRecurrencePattern(e.target.value as RecurrencePattern)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-stone-800 bg-stone-900 text-stone-100 focus:outline-none focus:ring-1 focus:border-amber-500"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly (Every 7 days)</option>
                        <option value="monthly">Monthly (Same day each month)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="recurrence-end-date" className="block text-xs font-medium text-stone-300 mb-1">
                        End Recurrence On
                      </label>
                      <input
                        id="recurrence-end-date"
                        type="date"
                        min={date}
                        value={recurrenceEndDate}
                        onChange={(e) => {
                          setRecurrenceEndDate(e.target.value);
                          if (errors.recurrenceEndDate) {
                            setErrors((prev) => ({ ...prev, recurrenceEndDate: '' }));
                          }
                        }}
                        className={`w-full px-3 py-2 text-xs rounded-lg border bg-stone-900 text-stone-100 focus:outline-none focus:ring-1 ${
                          errors.recurrenceEndDate
                            ? 'border-rose-500'
                            : 'border-stone-800 focus:border-amber-500'
                        }`}
                      />
                      {errors.recurrenceEndDate && (
                        <p className="mt-1 text-[11px] text-rose-400">
                          {errors.recurrenceEndDate}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2.5 bg-stone-900/90 border border-stone-800/60 rounded-lg text-[11px] text-stone-400">
                    <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Each occurrence will be individually booked and saved. If any date has a time conflict with another appointment, it will be highlighted or skipped.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description Field */}
          <div>
            <label htmlFor="appointment-description" className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
              Description <span className="text-stone-500 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              id="appointment-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting agenda, notes, attendees or conference link..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-800 bg-stone-950 text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-2 focus:border-amber-500/60 focus:ring-amber-500/20 transition-colors resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800 shrink-0">
            <button
              id="btn-form-cancel"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-stone-300 bg-stone-900 hover:bg-stone-800 border border-stone-700/80 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="btn-form-save"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-sm shadow-amber-500/10 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <CheckCircle size={15} />
                  <span>{isRecurring ? 'Create Recurring Series' : isEditing ? 'Save Changes' : 'Create Appointment'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
