import { NextRequest, NextResponse } from 'next/server';
import { getAppointmentById, updateAppointment, cancelAppointment } from '@/lib/appointments';
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Appointment ID is required.' }, { status: 400 });
    }

    const { authToken } = await resolveUser(request);
    const appointment = await getAppointmentById(id, authToken);
    if (!appointment) {
      return NextResponse.json({ success: false, error: 'Appointment not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve appointment.' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Appointment ID is required.' }, { status: 400 });
    }

    const body = await request.json();
    const { title, description, appointment_date, start_time, end_time, status } = body;

    // If updating time or title, validate
    if (title !== undefined && (!title || !title.trim())) {
      return NextResponse.json({ success: false, error: 'Title cannot be empty.' }, { status: 400 });
    }

    if (start_time && end_time && end_time <= start_time) {
      return NextResponse.json(
        { success: false, error: 'End time must be later than start time.' },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {};
    if (title !== undefined) updatePayload.title = title.trim();
    if (description !== undefined) updatePayload.description = description ? description.trim() : null;
    if (appointment_date !== undefined) updatePayload.appointment_date = appointment_date;
    if (start_time !== undefined) updatePayload.start_time = start_time;
    if (end_time !== undefined) updatePayload.end_time = end_time;
    if (status !== undefined) updatePayload.status = status;

    const { userId, authToken } = await resolveUser(request);
    const result = await updateAppointment(id, updatePayload, userId, authToken);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Unable to update appointment. Time slot already booked.',
          conflictingAppointment: result.conflictingAppointment,
        },
        { status: result.error?.includes('not found') ? 404 : 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Appointment updated successfully.',
      appointment: result.appointment,
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while updating appointment.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Appointment ID is required.' }, { status: 400 });
    }

    const { userId, authToken } = await resolveUser(request);
    const result = await cancelAppointment(id, userId, authToken);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to cancel appointment.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Appointment cancelled successfully.',
      appointment: result.appointment,
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while cancelling appointment.' },
      { status: 500 }
    );
  }
}
