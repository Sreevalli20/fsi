export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly';

export interface Appointment {
  id: string;
  user_id?: string | null;
  title: string;
  description: string | null;
  appointment_date: string; // YYYY-MM-DD format
  start_time: string; // HH:mm or HH:mm:ss format
  end_time: string; // HH:mm or HH:mm:ss format
  status: AppointmentStatus;
  recurrence_id?: string | null;
  recurrence_pattern?: RecurrencePattern | null;
  recurrence_end_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentFormData {
  title: string;
  description?: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status?: AppointmentStatus;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern;
  recurrence_end_date?: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingAppointment?: Appointment;
  message?: string;
}

export interface RecurringCreationResult {
  success: boolean;
  createdAppointments: Appointment[];
  conflicts: Array<{
    date: string;
    message: string;
    conflictingAppointment?: Appointment;
  }>;
  totalOccurrences: number;
  createdCount: number;
  skippedCount: number;
  error?: string;
}
