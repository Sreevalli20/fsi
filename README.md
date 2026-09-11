# Appointment Board — Full Stack Internship Practical Task

A production-ready, full-stack **Appointment Board** built for small teams with real-time time-conflict prevention, date/status filtering, and Supabase PostgreSQL integration.

Designed and architected using **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase PostgreSQL**.

## Live Deployment

**🚀 [https://appointment-board-virid.vercel.app](https://appointment-board-virid.vercel.app)**

---

## Features

- **Appointment Management**: Create, edit, complete, and cancel appointments with immediate visual feedback.
- **Double-Layer Conflict Detection**:
  - Validated on both client-side and server-side API routes.
  - Detects overlapping intervals using: `existing.start_time < new.end_time AND existing.end_time > new.start_time`.
  - Automatically excludes the current appointment when editing.
  - Automatically frees up time slots when an appointment is marked as **Cancelled**.
- **Visual Status Hierarchy**:
  - **Scheduled**: Clean blue badge with actionable Complete and Cancel buttons.
  - **Completed**: Green badge with check icon.
  - **Cancelled**: Soft muted styling with strikethrough and slot-available indicator.
- **Multi-Factor Filtering**: Filter appointments simultaneously by date and status, with an instant one-click reset.
- **Persistent Storage**: Backed by Supabase PostgreSQL with RLS and automated timestamp updates. Includes initial seed samples when running in development/demo mode.
- **Vercel Ready**: Full compatibility with Vercel deployment workflows.

---

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase PostgreSQL (Free Tier)
- **Icons**: Lucide React
- **Hosting / Deployment**: Vercel

---

## Quick Setup Instructions

### 1. Prerequisites
Ensure you have **Node.js 18+** installed on your local machine:
```bash
node -v
npm -v
```

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/appointment-board.git
cd appointment-board
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Create a Supabase Project & Run SQL Schema
1. Sign up or log into [Supabase](https://supabase.com).
2. Create a new project (Free Tier).
3. Navigate to the **SQL Editor** in your Supabase dashboard.
4. Open the `schema.sql` file provided in this repository, copy its contents, and execute it in the Supabase SQL editor.
5. This provisions:
   - The `appointments` table with constraints (`end_time > start_time`).
   - Query indexes for `appointment_date` and `status`.
   - Row Level Security (RLS) policies.
   - Initial sample appointments for team review.

### 5. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Add your Supabase project URL and Anon API key:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 6. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the live Appointment Board.

### 7. Production Build
Verify that the project builds cleanly without errors:
```bash
npm run build
```

---

## Deploying to Vercel

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Log into [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your `appointment-board` repository.
4. In the **Environment Variables** section, add the same variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key
5. Click **Deploy**. Vercel will automatically build and deploy the Next.js application.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/appointments?date=YYYY-MM-DD&status=Scheduled` | Retrieve appointments with optional date & status filters |
| `POST` | `/api/appointments` | Create appointment with conflict check (`409` on overlap) |
| `PUT` | `/api/appointments/[id]` | Update appointment title, time, date, or status |
| `DELETE` | `/api/appointments/[id]` | Cancel appointment (sets status to `Cancelled`) |

---

## Database Schema (`schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT check_end_time_after_start_time CHECK (end_time > start_time)
);
```

---

## License
MIT License. Built for internship practical task submission.
