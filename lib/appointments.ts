import {
  Appointment,
  AppointmentFormData,
  AppointmentStatus,
  ConflictCheckResult,
  RecurrencePattern,
  RecurringCreationResult,
} from '@/types/appointment';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  checkSupabaseHealth,
  resetSupabaseHealthCache,
} from './supabase';

/**
 * Normalizes time string to HH:MM format for reliable comparison and display.
 */
export function normalizeTime(time: string): string {
  if (!time) return '00:00';
  const parts = time.trim().split(':');
  const hours = parts[0].padStart(2, '0');
  const minutes = (parts[1] || '00').padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Normalizes time string to standard HH:MM:00 for database storage.
 */
export function toDbTime(time: string): string {
  const norm = normalizeTime(time);
  return `${norm}:00`;
}

/**
 * Checks for time conflicts between an appointment slot and existing appointments on the same date.
 * Rule:
 * existing.start_time < new.end_time AND existing.end_time > new.start_time
 * Excludes cancelled appointments and excludes the current appointment when editing.
 */
export function checkTimeConflict(
  existingAppointments: Appointment[],
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: string
): ConflictCheckResult {
  const newStart = normalizeTime(startTime);
  const newEnd = normalizeTime(endTime);

  // Validate end time is after start time
  if (newEnd <= newStart) {
    return {
      hasConflict: true,
      message: 'End time must be later than start time.',
    };
  }

  for (const appt of existingAppointments) {
    // Only check appointments on the same date
    if (appt.appointment_date !== date) continue;

    // Ignore cancelled appointments (freed slot)
    if (appt.status === 'Cancelled') continue;

    // Exclude the current appointment being edited
    if (excludeId && appt.id === excludeId) continue;

    const existingStart = normalizeTime(appt.start_time);
    const existingEnd = normalizeTime(appt.end_time);

    // Conflict condition: existing.start_time < new.end_time AND existing.end_time > new.start_time
    if (existingStart < newEnd && existingEnd > newStart) {
      return {
        hasConflict: true,
        conflictingAppointment: appt,
        message: `This time slot conflicts with "${appt.title}" (${formatTimeDisplay(existingStart)} - ${formatTimeDisplay(existingEnd)}).`,
      };
    }
  }

  return { hasConflict: false };
}

export function formatTimeDisplay(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Generate dynamic sample data with relative dates
function getInitialSampleAppointments(): Appointment[] {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const today = formatYMD(now);
  const tomorrow = formatYMD(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const dayAfter = formatYMD(new Date(now.getTime() + 48 * 60 * 60 * 1000));

  return [
    {
      id: 'a1111111-1111-1111-1111-111111111111',
      user_id: null,
      title: 'Frontend Sprint Planning',
      description: 'Review sprint backlog, finalize sprint goal, and allocate priority UI tasks for next release.',
      appointment_date: today,
      start_time: '09:00',
      end_time: '10:00',
      status: 'Completed',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: 'b2222222-2222-2222-2222-222222222222',
      user_id: null,
      title: 'Design System & Component Review',
      description: 'Walkthrough of new AppointmentBoard card components, accessibility standards, and spacing scale.',
      appointment_date: today,
      start_time: '10:30',
      end_time: '11:30',
      status: 'Scheduled',
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'c3333333-3333-3333-3333-333333333333',
      user_id: null,
      title: 'Database Architecture Sync',
      description: 'Cancelled due to conflict with all-hands meeting. Slot is now freed up for booking.',
      appointment_date: today,
      start_time: '13:00',
      end_time: '14:00',
      status: 'Cancelled',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    },
    {
      id: 'd4444444-4444-4444-4444-444444444444',
      user_id: null,
      title: 'Client Consultation: Cloud Strategy',
      description: 'Initial discovery call to understand system requirements, compliance scope, and database migration.',
      appointment_date: tomorrow,
      start_time: '14:00',
      end_time: '15:30',
      status: 'Scheduled',
      created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    },
    {
      id: 'e5555555-5555-5555-5555-555555555555',
      user_id: null,
      title: 'Weekly Team Demo & Retrospective',
      description: 'Showcase feature milestones, gather peer feedback, and celebrate team wins for the week.',
      appointment_date: dayAfter,
      start_time: '16:00',
      end_time: '17:00',
      status: 'Scheduled',
      created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
  ];
}

// Global in-memory fallback store across API route invocations
const globalForMemory = globalThis as unknown as {
  __appointmentMemoryStore?: Appointment[];
};

function ensureMemoryStore() {
  if (!globalForMemory.__appointmentMemoryStore || globalForMemory.__appointmentMemoryStore.length === 0) {
    globalForMemory.__appointmentMemoryStore = getInitialSampleAppointments();
  }
}

ensureMemoryStore();

export interface AppointmentQueryOptions {
  date?: string;
  status?: string;
  userId?: string | null;
  authToken?: string;
}

/**
 * Fetch appointments with user protection and optional filters
 */
export async function getAppointments(options?: AppointmentQueryOptions): Promise<Appointment[]> {
  ensureMemoryStore();
  const { date, status, userId, authToken } = options || {};

  if (isSupabaseConfigured) {
    const health = await checkSupabaseHealth();
    if (health.tableExists) {
      const supabase = getSupabaseClient(authToken);
      if (supabase) {
        let query = supabase
          .from('appointments')
          .select('*')
          .order('appointment_date', { ascending: true })
          .order('start_time', { ascending: true });

        if (userId) {
          query = query.eq('user_id', userId);
        }

        if (date) {
          query = query.eq('appointment_date', date);
        }

        if (status && status !== 'All') {
          query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map(formatDbRecord);
        }
        if (error) {
          // If schema changed or table dropped, invalidate health cache so next calls don't query
          resetSupabaseHealthCache();
        }
      }
    }
  }

  // Fallback to in-memory store
  return filterInMemory(globalForMemory.__appointmentMemoryStore || [], options);
}

function filterInMemory(list: Appointment[], options?: AppointmentQueryOptions): Appointment[] {
  let result = [...list];
  const { date, status, userId } = options || {};

  // Protect per user: if userId is passed, match that user's appointments (or null/sample appointments if none exist yet)
  if (userId) {
    const userSpecific = result.filter((a) => a.user_id === userId);
    // If user has appointments, show their own. If brand new user with 0, show empty or shared sample
    result = userSpecific.length > 0 ? userSpecific : result.filter((a) => a.user_id === userId || a.user_id === null);
  }

  if (date) {
    result = result.filter((a) => a.appointment_date === date);
  }
  if (status && status !== 'All') {
    result = result.filter((a) => a.status === status);
  }

  // Sort by date, then start_time
  result.sort((a, b) => {
    if (a.appointment_date !== b.appointment_date) {
      return a.appointment_date.localeCompare(b.appointment_date);
    }
    return a.start_time.localeCompare(b.start_time);
  });
  return result;
}

/**
 * Fetch a single appointment by ID
 */
export async function getAppointmentById(id: string, authToken?: string): Promise<Appointment | null> {
  ensureMemoryStore();

  if (isSupabaseConfigured) {
    const health = await checkSupabaseHealth();
    if (health.tableExists) {
      const supabase = getSupabaseClient(authToken);
      if (supabase) {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return formatDbRecord(data);
        }
      }
    }
  }

  const found = globalForMemory.__appointmentMemoryStore?.find((a) => a.id === id);
  return found || null;
}

/**
 * Generates an array of occurrence dates for a recurrence rule
 */
export function generateRecurrenceDates(
  startDateStr: string,
  pattern: RecurrencePattern,
  endDateStr?: string,
  maxOccurrences = 52
): string[] {
  const dates: string[] = [];
  const [startY, startM, startD] = startDateStr.split('-').map(Number);
  const current = new Date(startY, startM - 1, startD);

  let limitDate: Date;
  if (endDateStr) {
    const [endY, endM, endD] = endDateStr.split('-').map(Number);
    limitDate = new Date(endY, endM - 1, endD);
  } else {
    // Default to 8 weeks out
    limitDate = new Date(current.getTime() + 56 * 24 * 60 * 60 * 1000);
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  while (current <= limitDate && dates.length < maxOccurrences) {
    dates.push(formatYMD(current));

    if (pattern === 'daily') {
      current.setDate(current.getDate() + 1);
    } else if (pattern === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (pattern === 'monthly') {
      current.setMonth(current.getMonth() + 1);
    } else {
      break;
    }
  }

  return dates;
}

/**
 * Creates recurring appointment entries for each occurrence, respecting time conflict logic
 */
export async function createRecurringAppointments(
  formData: AppointmentFormData,
  userId?: string | null,
  authToken?: string
): Promise<RecurringCreationResult> {
  const pattern = formData.recurrence_pattern || 'weekly';
  const recurrenceDates = generateRecurrenceDates(
    formData.appointment_date,
    pattern,
    formData.recurrence_end_date
  );

  const normStart = normalizeTime(formData.start_time);
  const normEnd = normalizeTime(formData.end_time);

  if (normEnd <= normStart) {
    return {
      success: false,
      createdAppointments: [],
      conflicts: [],
      totalOccurrences: recurrenceDates.length,
      createdCount: 0,
      skippedCount: 0,
      error: 'End time must be later than start time.',
    };
  }

  const recurrenceId = crypto.randomUUID();
  const createdAppointments: Appointment[] = [];
  const conflicts: Array<{ date: string; message: string; conflictingAppointment?: Appointment }> = [];

  // Evaluate conflict for each occurrence
  for (const occDate of recurrenceDates) {
    const existingOnDate = await getAppointments({ date: occDate, userId, authToken });
    const conflict = checkTimeConflict(existingOnDate, occDate, normStart, normEnd);

    if (conflict.hasConflict) {
      conflicts.push({
        date: occDate,
        message: conflict.message || `Conflict on ${formatDateDisplay(occDate)}`,
        conflictingAppointment: conflict.conflictingAppointment,
      });
    } else {
      // Create this occurrence
      const res = await createSingleAppointment({
        ...formData,
        appointment_date: occDate,
        recurrence_id: recurrenceId,
        recurrence_pattern: pattern,
        recurrence_end_date: formData.recurrence_end_date,
      }, userId, authToken);

      if (res.success && res.appointment) {
        createdAppointments.push(res.appointment);
      } else if (res.error) {
        conflicts.push({
          date: occDate,
          message: res.error,
          conflictingAppointment: res.conflictingAppointment,
        });
      }
    }
  }

  if (createdAppointments.length === 0 && conflicts.length > 0) {
    return {
      success: false,
      createdAppointments: [],
      conflicts,
      totalOccurrences: recurrenceDates.length,
      createdCount: 0,
      skippedCount: conflicts.length,
      error: conflicts[0]?.message || 'All occurrence time slots have conflicts with existing appointments.',
    };
  }

  return {
    success: true,
    createdAppointments,
    conflicts,
    totalOccurrences: recurrenceDates.length,
    createdCount: createdAppointments.length,
    skippedCount: conflicts.length,
  };
}

/**
 * Creates a single appointment with conflict check
 */
async function createSingleAppointment(
  formData: AppointmentFormData & {
    recurrence_id?: string;
    recurrence_pattern?: RecurrencePattern;
    recurrence_end_date?: string;
  },
  userId?: string | null,
  authToken?: string
): Promise<{
  success: boolean;
  appointment?: Appointment;
  error?: string;
  conflictingAppointment?: Appointment;
}> {
  if (!formData.title?.trim()) {
    return { success: false, error: 'Title is required.' };
  }
  if (!formData.appointment_date) {
    return { success: false, error: 'Date is required.' };
  }
  if (!formData.start_time) {
    return { success: false, error: 'Start time is required.' };
  }
  if (!formData.end_time) {
    return { success: false, error: 'End time is required.' };
  }

  const normStart = normalizeTime(formData.start_time);
  const normEnd = normalizeTime(formData.end_time);

  if (normEnd <= normStart) {
    return { success: false, error: 'End time must be later than start time.' };
  }

  // Conflict check against non-cancelled appointments on that date
  const allOnDate = await getAppointments({ date: formData.appointment_date, userId, authToken });
  const conflict = checkTimeConflict(allOnDate, formData.appointment_date, normStart, normEnd);

  if (conflict.hasConflict) {
    return {
      success: false,
      error: conflict.message || 'Unable to create appointment. This time slot is already booked.',
      conflictingAppointment: conflict.conflictingAppointment,
    };
  }

  const supabase = getSupabaseClient(authToken);
  const nowIso = new Date().toISOString();

  const newRecord = {
    title: formData.title.trim(),
    description: formData.description?.trim() || null,
    appointment_date: formData.appointment_date,
    start_time: toDbTime(normStart),
    end_time: toDbTime(normEnd),
    status: (formData.status || 'Scheduled') as AppointmentStatus,
    user_id: userId || null,
    recurrence_id: formData.recurrence_id || null,
    recurrence_pattern: formData.recurrence_pattern || null,
    recurrence_end_date: formData.recurrence_end_date || null,
  };

  if (isSupabaseConfigured) {
    const health = await checkSupabaseHealth();
    if (health.tableExists) {
      const supabase = getSupabaseClient(authToken);
      if (supabase) {
        const { data, error } = await supabase
          .from('appointments')
          .insert([newRecord])
          .select()
          .single();

        if (!error && data) {
          const created = formatDbRecord(data);
          globalForMemory.__appointmentMemoryStore?.push(created);
          return { success: true, appointment: created };
        }
        if (error) {
          resetSupabaseHealthCache();
        }
      }
    }
  }

  // In-memory creation
  const created: Appointment = {
    id: crypto.randomUUID(),
    user_id: newRecord.user_id,
    title: newRecord.title,
    description: newRecord.description,
    appointment_date: newRecord.appointment_date,
    start_time: normStart,
    end_time: normEnd,
    status: newRecord.status,
    recurrence_id: newRecord.recurrence_id,
    recurrence_pattern: newRecord.recurrence_pattern,
    recurrence_end_date: newRecord.recurrence_end_date,
    created_at: nowIso,
    updated_at: nowIso,
  };

  globalForMemory.__appointmentMemoryStore?.push(created);
  return { success: true, appointment: created };
}

/**
 * Public createAppointment supporting both single and recurring appointments
 */
export async function createAppointment(
  formData: AppointmentFormData,
  userId?: string | null,
  authToken?: string
): Promise<{
  success: boolean;
  appointment?: Appointment;
  recurringResult?: RecurringCreationResult;
  error?: string;
  conflictingAppointment?: Appointment;
}> {
  if (formData.is_recurring && formData.recurrence_pattern) {
    const recResult = await createRecurringAppointments(formData, userId, authToken);
    if (!recResult.success) {
      return {
        success: false,
        error: recResult.error,
        conflictingAppointment: recResult.conflicts[0]?.conflictingAppointment,
        recurringResult: recResult,
      };
    }
    return {
      success: true,
      appointment: recResult.createdAppointments[0],
      recurringResult: recResult,
    };
  }

  return createSingleAppointment(formData, userId, authToken);
}

/**
 * Update an appointment with conflict check
 */
export async function updateAppointment(
  id: string,
  updateData: Partial<AppointmentFormData> & { status?: AppointmentStatus },
  userId?: string | null,
  authToken?: string
): Promise<{
  success: boolean;
  appointment?: Appointment;
  error?: string;
  conflictingAppointment?: Appointment;
}> {
  const existing = await getAppointmentById(id, authToken);
  if (!existing) {
    return { success: false, error: 'Appointment not found.' };
  }

  const targetDate = updateData.appointment_date || existing.appointment_date;
  const targetStart = normalizeTime(updateData.start_time || existing.start_time);
  const targetEnd = normalizeTime(updateData.end_time || existing.end_time);
  const targetStatus = updateData.status || existing.status;

  if (targetEnd <= targetStart) {
    return { success: false, error: 'End time must be later than start time.' };
  }

  // If status is not Cancelled, check for conflict with other appointments
  if (targetStatus !== 'Cancelled') {
    const allOnDate = await getAppointments({ date: targetDate, userId, authToken });
    const conflict = checkTimeConflict(allOnDate, targetDate, targetStart, targetEnd, id);
    if (conflict.hasConflict) {
      return {
        success: false,
        error: conflict.message || 'Unable to update appointment. This time slot is already booked.',
        conflictingAppointment: conflict.conflictingAppointment,
      };
    }
  }

  const supabase = getSupabaseClient(authToken);
  const nowIso = new Date().toISOString();

  const patch: Record<string, unknown> = {
    updated_at: nowIso,
  };

  if (updateData.title !== undefined) patch.title = updateData.title.trim();
  if (updateData.description !== undefined) patch.description = updateData.description?.trim() || null;
  if (updateData.appointment_date !== undefined) patch.appointment_date = updateData.appointment_date;
  if (updateData.start_time !== undefined) patch.start_time = toDbTime(targetStart);
  if (updateData.end_time !== undefined) patch.end_time = toDbTime(targetEnd);
  if (updateData.status !== undefined) patch.status = updateData.status;

  if (isSupabaseConfigured) {
    const health = await checkSupabaseHealth();
    if (health.tableExists) {
      const supabase = getSupabaseClient(authToken);
      if (supabase) {
        const { data, error } = await supabase
          .from('appointments')
          .update(patch)
          .eq('id', id)
          .select()
          .single();

        if (!error && data) {
          const updated = formatDbRecord(data);
          updateMemory(updated);
          return { success: true, appointment: updated };
        }
        if (error) {
          resetSupabaseHealthCache();
        }
      }
    }
  }

  // In-memory update
  const updated: Appointment = {
    ...existing,
    title: (patch.title as string) ?? existing.title,
    description: (patch.description as string | null) ?? existing.description,
    appointment_date: (patch.appointment_date as string) ?? existing.appointment_date,
    start_time: targetStart,
    end_time: targetEnd,
    status: (patch.status as AppointmentStatus) ?? existing.status,
    updated_at: nowIso,
  };

  updateMemory(updated);
  return { success: true, appointment: updated };
}

/**
 * Cancel an appointment (soft-delete / update status to 'Cancelled' so slot is freed)
 */
export async function cancelAppointment(
  id: string,
  userId?: string | null,
  authToken?: string
): Promise<{ success: boolean; appointment?: Appointment; error?: string }> {
  return updateAppointment(id, { status: 'Cancelled' }, userId, authToken);
}

function updateMemory(updated: Appointment) {
  if (!globalForMemory.__appointmentMemoryStore) return;
  const index = globalForMemory.__appointmentMemoryStore.findIndex((a) => a.id === updated.id);
  if (index !== -1) {
    globalForMemory.__appointmentMemoryStore[index] = updated;
  }
}

// Convert database record to clean Appointment object
function formatDbRecord(record: Record<string, any>): Appointment {
  return {
    id: record.id,
    user_id: record.user_id || null,
    title: record.title,
    description: record.description || null,
    appointment_date: record.appointment_date,
    start_time: normalizeTime(record.start_time),
    end_time: normalizeTime(record.end_time),
    status: record.status as AppointmentStatus,
    recurrence_id: record.recurrence_id || null,
    recurrence_pattern: record.recurrence_pattern || null,
    recurrence_end_date: record.recurrence_end_date || null,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}
