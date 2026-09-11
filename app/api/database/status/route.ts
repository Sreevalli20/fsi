import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  checkSupabaseHealth,
  resetSupabaseHealthCache,
  isSupabaseConfigured,
  getSupabaseProjectId,
  getSupabaseClient,
} from '@/lib/supabase';

function getSchemaSql(): string {
  try {
    const schemaPath = path.join(process.cwd(), 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      return fs.readFileSync(schemaPath, 'utf-8');
    }
  } catch {
    // Ignore error
  }
  return '';
}

export async function GET() {
  try {
    const health = await checkSupabaseHealth();
    const projectId = getSupabaseProjectId();
    const schemaSql = getSchemaSql();
    const dashboardSqlUrl = projectId
      ? `https://supabase.com/dashboard/project/${projectId}/sql/new`
      : 'https://supabase.com/dashboard';

    return NextResponse.json({
      success: true,
      ...health,
      isConfigured: isSupabaseConfigured,
      projectId,
      dashboardSqlUrl,
      schemaSql,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        isConfigured: isSupabaseConfigured,
        tableExists: false,
        error: error?.message || 'Failed to check database health.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    resetSupabaseHealthCache();
    const health = await checkSupabaseHealth(true);
    const projectId = getSupabaseProjectId();
    const schemaSql = getSchemaSql();
    const dashboardSqlUrl = projectId
      ? `https://supabase.com/dashboard/project/${projectId}/sql/new`
      : 'https://supabase.com/dashboard';

    // If table now exists, check if seed data is needed
    if (health.tableExists && isSupabaseConfigured) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { count } = await client.from('appointments').select('*', { count: 'exact', head: true });
          if (count === 0) {
            // Table exists but is completely empty: insert seed rows from sample
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

            await client.from('appointments').insert([
              {
                title: 'Frontend Sprint Planning',
                description: 'Review sprint backlog, finalize sprint goal, and allocate priority UI tasks for next release.',
                appointment_date: today,
                start_time: '09:00:00',
                end_time: '10:00:00',
                status: 'Completed',
              },
              {
                title: 'Design System & Component Review',
                description: 'Walkthrough of new AppointmentBoard card components, accessibility standards, and spacing scale.',
                appointment_date: today,
                start_time: '10:30:00',
                end_time: '11:30:00',
                status: 'Scheduled',
              },
              {
                title: 'Database Architecture Sync',
                description: 'Cancelled due to conflict with all-hands meeting. Slot is now freed up for booking.',
                appointment_date: today,
                start_time: '13:00:00',
                end_time: '14:00:00',
                status: 'Cancelled',
              }
            ]);
          }
        }
      } catch {
        // Seeding error can be ignored non-fatally
      }
    }

    return NextResponse.json({
      success: true,
      ...health,
      isConfigured: isSupabaseConfigured,
      projectId,
      dashboardSqlUrl,
      schemaSql,
      message: health.tableExists
        ? 'Supabase database is active and appointments table is ready!'
        : health.error || 'Appointments table not detected in schema cache.',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        isConfigured: isSupabaseConfigured,
        tableExists: false,
        error: error?.message || 'Failed to verify database.',
      },
      { status: 500 }
    );
  }
}
