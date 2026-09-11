-- ===================================================================
-- Supabase PostgreSQL Schema for Appointment Board
-- ===================================================================

-- 1. Create table with user_id and recurrence support
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
  recurrence_id UUID,
  recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly')),
  recurrence_end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_end_time_after_start_time CHECK (end_time > start_time)
);

-- If table already existed, ensure columns are added:
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_id UUID;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly'));
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;

-- 2. Indexes for fast date, user, recurrence, and status querying
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments (appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments (user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_recurrence_id ON appointments (recurrence_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Users can only view and manage their own appointments
-- Note: When user_id IS NULL, it allows public/sample access for unauthenticated demo environments.
DROP POLICY IF EXISTS "Users can only view and manage their own appointments" ON appointments;
CREATE POLICY "Users can only view and manage their own appointments"
  ON appointments
  FOR ALL
  USING (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL))
  WITH CHECK (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL));

-- 5. Automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_appointments_updated_at ON appointments;
CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- Sample Seed Data (Scheduled, Completed, and Cancelled appointments)
-- ===================================================================
INSERT INTO appointments (id, title, description, appointment_date, start_time, end_time, status)
VALUES
  (
    'a1111111-1111-1111-1111-111111111111',
    'Frontend Sprint Planning',
    'Review sprint backlog, finalize sprint goal, and allocate priority UI tasks for next release.',
    CURRENT_DATE,
    '09:00:00',
    '10:00:00',
    'Completed'
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    'Design System & Component Review',
    'Walkthrough of new AppointmentBoard card components, accessibility standards, and spacing scale.',
    CURRENT_DATE,
    '10:30:00',
    '11:30:00',
    'Scheduled'
  ),
  (
    'c3333333-3333-3333-3333-333333333333',
    'Database Architecture Sync',
    'Cancelled due to conflict with all-hands meeting. Slot is now freed up for booking.',
    CURRENT_DATE,
    '13:00:00',
    '14:00:00',
    'Cancelled'
  ),
  (
    'd4444444-4444-4444-4444-444444444444',
    'Client Consultation: Cloud Strategy',
    'Initial discovery call to understand system requirements, compliance scope, and database migration.',
    CURRENT_DATE + INTERVAL '1 day',
    '14:00:00',
    '15:30:00',
    'Scheduled'
  ),
  (
    'e5555555-5555-5555-5555-555555555555',
    'Weekly Team Demo & Retrospective',
    'Showcase feature milestones, gather peer feedback, and celebrate team wins for the week.',
    CURRENT_DATE + INTERVAL '2 days',
    '16:00:00',
    '17:00:00',
    'Scheduled'
  )
ON CONFLICT (id) DO NOTHING;
