import { NextRequest, NextResponse } from 'next/server';
import { getAppointments, createAppointment } from '@/lib/appointments';
import { AppointmentFormData } from '@/types/appointment';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

async function resolveUser(request: NextRequest): Promise<{ userId: string | null; authToken?: string }> {
  const authHeader = request.headers.get('Authorization');
  const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const clientUserId = request.headers.get('x-user-id');

  if (authToken && isSupabaseConfigured) {
    const supabase = getSupabaseClient(authToken);
    if (supabase) {
      const { data } = await supabase.auth.getUser(authToken);
      if (data?.user?.id) {
        return { userId: data.user.id, authToken };
      }
    }
  }

  return { userId: clientUserId || null, authToken };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date') || undefined;
    const status = searchParams.get('status') || undefined;
    const queryUserId = searchParams.get('userId') || undefined;

    const { userId, authToken } = await resolveUser(request);
    const effectiveUserId = queryUserId || userId;

    const appointments = await getAppointments({
      date,
      status,
      userId: effectiveUserId,
      authToken,
    });

    return NextResponse.json({
      success: true,
      appointments,
      count: appointments.length,
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch appointments. Please try again later.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      appointment_date,
      start_time,
      end_time,
      status,
      is_recurring,
      recurrence_pattern,
      recurrence_end_date,
    } = body;

    // Field validations
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'Title is required.' },
        { status: 400 }
      );
    }

    if (!appointment_date || typeof appointment_date !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Date is required.' },
        { status: 400 }
      );
    }

    if (!start_time || typeof start_time !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Start time is required.' },
        { status: 400 }
      );
    }

    if (!end_time || typeof end_time !== 'string') {
      return NextResponse.json(
        { success: false, error: 'End time is required.' },
        { status: 400 }
      );
    }

    if (end_time <= start_time) {
      return NextResponse.json(
        { success: false, error: 'End time must be later than start time.' },
        { status: 400 }
      );
    }

    if (is_recurring) {
      if (!recurrence_pattern || !['daily', 'weekly', 'monthly'].includes(recurrence_pattern)) {
        return NextResponse.json(
          { success: false, error: 'Valid recurrence pattern (daily, weekly, monthly) is required for recurring appointments.' },
          { status: 400 }
        );
      }
      if (recurrence_end_date && recurrence_end_date < appointment_date) {
        return NextResponse.json(
          { success: false, error: 'Recurrence end date must be on or after the starting appointment date.' },
          { status: 400 }
        );
      }
    }

    const { userId, authToken } = await resolveUser(request);

    const formData: AppointmentFormData = {
      title: title.trim(),
      description: description?.trim() || '',
      appointment_date,
      start_time,
      end_time,
      status: status || 'Scheduled',
      is_recurring: Boolean(is_recurring),
      recurrence_pattern: is_recurring ? recurrence_pattern : undefined,
      recurrence_end_date: is_recurring ? recurrence_end_date : undefined,
    };

    const result = await createAppointment(formData, userId, authToken);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Unable to create appointment. This time slot is already booked.',
          conflictingAppointment: result.conflictingAppointment,
          recurringResult: result.recurringResult,
        },
        { status: 409 }
      );
    }

    const message = result.recurringResult
      ? `Generated ${result.recurringResult.createdCount} recurring appointment occurrence(s)${
          result.recurringResult.skippedCount > 0
            ? ` (${result.recurringResult.skippedCount} skipped due to time conflicts)`
            : ''
        }.`
      : 'Appointment created successfully.';

    return NextResponse.json(
      {
        success: true,
        message,
        appointment: result.appointment,
        recurringResult: result.recurringResult,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating appointment:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while creating appointment.' },
      { status: 500 }
    );
  }
}
