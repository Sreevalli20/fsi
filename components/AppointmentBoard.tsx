'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Appointment, AppointmentFormData, AppointmentStatus } from '@/types/appointment';
import { AppointmentCard } from './AppointmentCard';
import { AppointmentForm } from './AppointmentForm';
import { CalendarView } from './CalendarView';
import { AuthModal } from './AuthModal';
import { useAuth } from '@/lib/auth-context';
import {
  Calendar as CalendarIcon,
  Plus,
  Filter,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Database,
  Clock,
  Check,
  Ban,
  CalendarDays,
  LayoutGrid,
  CalendarRange,
  UserCheck,
  LogIn,
  LogOut,
  Shield,
  Repeat,
  Sparkles,
  Copy,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface DbStatusInfo {
  isConfigured: boolean;
  tableExists: boolean;
  projectId?: string;
  dashboardSqlUrl?: string;
  schemaSql?: string;
  error?: string;
  message?: string;
}

export function AppointmentBoard() {
  const { user, authToken, signOut } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Active view: 'board' | 'calendar'
  const [viewMode, setViewMode] = useState<'board' | 'calendar'>('board');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>(undefined);
  const [prefilledTime, setPrefilledTime] = useState<string | undefined>(undefined);

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Setup modal for Supabase schema & auth guide
  const [showDbInfoModal, setShowDbInfoModal] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatusInfo | null>(null);
  const [checkingDb, setCheckingDb] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Build headers with auth token and user ID
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (user?.id) {
      headers['x-user-id'] = user.id;
    }
    return headers;
  }, [authToken, user?.id]);

  // Fetch appointments from API
  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);
      if (statusFilter && statusFilter !== 'All') params.set('status', statusFilter);

      const headers = getAuthHeaders();
      const res = await fetch(`/api/appointments?${params.toString()}`, {
        headers,
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.appointments)) {
        setAppointments(data.appointments);
      } else {
        addToast('error', data.error || 'Failed to load appointments.');
      }
    } catch {
      addToast('error', 'Unable to reach appointments API.');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter, addToast, getAuthHeaders]);

  // Load database health and configuration status
  const loadDbStatus = useCallback(async (refresh = false) => {
    try {
      setCheckingDb(true);
      const res = await fetch('/api/database/status', {
        method: refresh ? 'POST' : 'GET',
      });
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
        if (refresh) {
          if (data.tableExists) {
            addToast('success', 'Supabase database verified! Appointments table is active.');
            loadAppointments();
          } else {
            addToast('info', 'Checked database: appointments table not detected yet.');
          }
        }
      }
    } catch {
      // Non-fatal
    } finally {
      setCheckingDb(false);
    }
  }, [addToast, loadAppointments]);

  // Reload when user or filters change
  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Initial database status check
  useEffect(() => {
    loadDbStatus();
  }, [loadDbStatus]);

  const handleCopySql = () => {
    const sql = dbStatus?.schemaSql || `-- Supabase PostgreSQL Schema
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
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only view and manage their own appointments"
  ON appointments FOR ALL
  USING (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL))
  WITH CHECK (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL));`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(sql);
      setCopiedSql(true);
      addToast('success', 'SQL Schema copied to clipboard!');
      setTimeout(() => setCopiedSql(false), 2500);
    }
  };

  // Handle create or update submit
  const handleSaveAppointment = async (
    formData: AppointmentFormData
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const headers = getAuthHeaders();

      if (editingAppointment) {
        // Update existing
        const res = await fetch(`/api/appointments/${editingAppointment.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(formData),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          const errorMsg =
            data.error || 'Unable to update appointment. This time slot is already booked.';
          addToast('error', errorMsg);
          return { success: false, error: errorMsg };
        }

        addToast('success', data.message || 'Appointment updated successfully.');
        await loadAppointments();
        return { success: true };
      } else {
        // Create new (single or recurring)
        const res = await fetch('/api/appointments', {
          method: 'POST',
          headers,
          body: JSON.stringify(formData),
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          const errorMsg =
            data.error || 'Unable to create appointment. This time slot is already booked.';
          addToast('error', errorMsg);
          return { success: false, error: errorMsg };
        }

        if (data.is_recurring && data.recurring_result) {
          const createdCount = data.recurring_result.created?.length || 1;
          const skippedCount = data.recurring_result.skipped?.length || 0;
          if (skippedCount > 0) {
            addToast(
              'info',
              `Created ${createdCount} recurring appointments (${skippedCount} skipped due to time conflicts).`
            );
          } else {
            addToast(
              'success',
              `Created ${createdCount} recurring appointments across scheduled dates.`
            );
          }
        } else {
          addToast('success', data.message || 'Appointment created successfully.');
        }

        await loadAppointments();
        return { success: true };
      }
    } catch (err: any) {
      const msg = err?.message || 'Server communication error.';
      addToast('error', msg);
      return { success: false, error: msg };
    }
  };

  // Handle Mark Completed
  const handleComplete = async (id: string) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'Completed' }),
      });
      const data = await res.json();

      if (data.success) {
        addToast('success', 'Appointment marked as completed.');
        await loadAppointments();
      } else {
        addToast('error', data.error || 'Could not update status.');
      }
    } catch (err) {
      addToast('error', 'Failed to update status.');
    }
  };

  // Handle Cancel Appointment
  const handleCancel = async (id: string) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();

      if (data.success) {
        addToast(
          'info',
          'Appointment cancelled successfully. The time slot is now freed for booking.'
        );
        await loadAppointments();
      } else {
        addToast('error', data.error || 'Could not cancel appointment.');
      }
    } catch (err) {
      addToast('error', 'Failed to cancel appointment.');
    }
  };

  const openAddModal = (dateStr?: string, timeStr?: string) => {
    setEditingAppointment(null);
    setPrefilledDate(dateStr);
    setPrefilledTime(timeStr);
    setIsModalOpen(true);
  };

  const openEditModal = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setPrefilledDate(undefined);
    setPrefilledTime(undefined);
    setIsModalOpen(true);
  };

  const handleClearFilters = () => {
    setDateFilter('');
    setStatusFilter('All');
  };

  const hasActiveFilters = Boolean(dateFilter || statusFilter !== 'All');

  // Metric stats calculation
  const stats = useMemo(() => {
    const total = appointments.length;
    const scheduled = appointments.filter((a) => a.status === 'Scheduled').length;
    const completed = appointments.filter((a) => a.status === 'Completed').length;
    const cancelled = appointments.filter((a) => a.status === 'Cancelled').length;
    const recurring = appointments.filter((a) => Boolean(a.recurrence_pattern)).length;
    return { total, scheduled, completed, cancelled, recurring };
  }, [appointments]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 pb-20">
      {/* Toast notifications container */}
      <div className="fixed top-5 right-5 z-60 space-y-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl border text-xs font-medium transition-all transform animate-in slide-in-from-top-2 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-950/50'
                : toast.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-rose-950/50'
                : 'bg-stone-900/95 text-stone-200 border-stone-800 shadow-stone-950'
            }`}
          >
            {toast.type === 'success' && (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            )}
            {toast.type === 'error' && (
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            )}
            {toast.type === 'info' && (
              <Clock size={16} className="text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 leading-snug">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-stone-400 hover:text-stone-200 p-0.5 rounded cursor-pointer"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Top Application Navigation & User Header */}
      <header className="bg-stone-950/90 border-b border-stone-800/80 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-xs">
              <CalendarDays size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 id="page-title" className="text-lg font-bold tracking-tight text-stone-100">
                  Appointment Board
                </h1>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Full Stack
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Team calendar with conflict prevention, recurring bookings & Supabase Auth
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Switcher: Board vs Calendar */}
            <div className="flex items-center bg-stone-900 border border-stone-800 rounded-xl p-1">
              <button
                id="btn-view-board"
                type="button"
                onClick={() => setViewMode('board')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'board'
                    ? 'bg-stone-800 text-stone-100 font-semibold shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <LayoutGrid size={14} />
                <span>Board</span>
              </button>
              <button
                id="btn-view-calendar"
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'calendar'
                    ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <CalendarRange size={14} />
                <span>Calendar</span>
              </button>
            </div>

            {/* Supabase Schema / Architecture modal trigger */}
            <button
              id="btn-db-status"
              type="button"
              onClick={() => setShowDbInfoModal(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                dbStatus?.tableExists
                  ? 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60 hover:bg-emerald-900/40'
                  : dbStatus?.isConfigured
                  ? 'text-amber-300 bg-amber-950/40 border-amber-700/60 hover:bg-amber-900/40'
                  : 'text-stone-300 bg-stone-900 border-stone-800 hover:bg-stone-800/80'
              }`}
              title="View Supabase PostgreSQL Schema & Database Status"
            >
              <Database
                size={13}
                className={
                  dbStatus?.tableExists
                    ? 'text-emerald-400'
                    : dbStatus?.isConfigured
                    ? 'text-amber-400'
                    : 'text-stone-400'
                }
              />
              <span className="hidden sm:inline">
                {dbStatus?.tableExists
                  ? 'Supabase Active'
                  : dbStatus?.isConfigured
                  ? 'Supabase: Setup Schema'
                  : 'Database & Auth'}
              </span>
            </button>

            {/* User Session / Switcher */}
            {user ? (
              <div className="flex items-center bg-stone-900 border border-stone-800 rounded-xl px-2.5 py-1 text-xs">
                <button
                  id="btn-user-profile"
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-2 text-stone-200 hover:text-amber-400 transition-colors cursor-pointer mr-2"
                  title="Click to switch user account"
                >
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] flex items-center justify-center border border-amber-500/40">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-xs truncate max-w-[110px]">
                    {(user.name || user.email).split(' ')[0]}
                  </span>
                </button>
                <button
                  id="btn-sign-out"
                  type="button"
                  onClick={signOut}
                  className="text-stone-500 hover:text-stone-300 p-1 rounded-md transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                id="btn-sign-in"
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl border border-amber-500/30 transition-colors cursor-pointer"
              >
                <LogIn size={13} />
                <span>Sign In</span>
              </button>
            )}

            {/* New Appointment Button */}
            <button
              id="btn-add-appointment"
              type="button"
              onClick={() => openAddModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs shadow-amber-500/10 transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>Book Slot</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* User Workspace Notice */}
        {user && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-stone-900/80 border border-stone-800 text-xs text-stone-400">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-amber-400 shrink-0" />
              <span>
                Viewing private workspace for <strong className="text-stone-200">{user.name || user.email}</strong> ({user.email}). RLS prevents other users from viewing your slots.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="text-amber-400 hover:text-amber-300 text-xs font-medium underline underline-offset-2 cursor-pointer"
            >
              Switch Account
            </button>
          </div>
        )}

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mb-6">
          <div
            id="metric-total"
            className="bg-stone-900 p-4 rounded-2xl border border-stone-800 shadow-sm flex flex-col"
          >
            <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
              Total Appointments
            </span>
            <span className="text-2xl font-bold text-stone-100 mt-1">{stats.total}</span>
          </div>

          <div
            id="metric-scheduled"
            className="bg-stone-900 p-4 rounded-2xl border border-stone-800 shadow-sm flex flex-col"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">
                Scheduled
              </span>
              <Clock size={14} className="text-amber-400" />
            </div>
            <span className="text-2xl font-bold text-amber-300 mt-1">{stats.scheduled}</span>
          </div>

          <div
            id="metric-completed"
            className="bg-stone-900 p-4 rounded-2xl border border-stone-800 shadow-sm flex flex-col"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
                Completed
              </span>
              <Check size={14} className="text-emerald-400" />
            </div>
            <span className="text-2xl font-bold text-emerald-300 mt-1">{stats.completed}</span>
          </div>

          <div
            id="metric-cancelled"
            className="bg-stone-900 p-4 rounded-2xl border border-stone-800 shadow-sm flex flex-col"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                Cancelled
              </span>
              <Ban size={14} className="text-stone-500" />
            </div>
            <span className="text-2xl font-bold text-stone-400 mt-1">{stats.cancelled}</span>
          </div>

          <div
            id="metric-recurring"
            className="bg-stone-900 p-4 rounded-2xl border border-stone-800 shadow-sm flex flex-col col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                Recurring
              </span>
              <Repeat size={14} className="text-amber-400" />
            </div>
            <span className="text-2xl font-bold text-stone-200 mt-1">{stats.recurring}</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-stone-900 rounded-2xl border border-stone-800 p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="filter-date"
                  className="text-xs font-semibold text-stone-400 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <CalendarIcon size={14} className="text-stone-500" />
                  <span>Date:</span>
                </label>
                <input
                  id="filter-date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium bg-stone-950 border border-stone-800 rounded-xl text-stone-200 focus:outline-none focus:ring-1 focus:border-amber-500"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="filter-status"
                  className="text-xs font-semibold text-stone-400 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Filter size={14} className="text-stone-500" />
                  <span>Status:</span>
                </label>
                <select
                  id="filter-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium bg-stone-950 border border-stone-800 rounded-xl text-stone-200 focus:outline-none focus:ring-1 focus:border-amber-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <button
                  id="btn-clear-filters"
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-400 bg-stone-800 hover:bg-stone-700/80 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-stone-400">
              <span>
                Displaying{' '}
                <strong className="text-stone-100">{appointments.length}</strong>{' '}
                {appointments.length === 1 ? 'appointment' : 'appointments'}
              </span>
            </div>
          </div>
        </div>

        {/* View Toggle Rendering: Calendar View vs Board View */}
        {viewMode === 'calendar' ? (
          <CalendarView
            appointments={appointments}
            onSelectAppointment={openEditModal}
            onCreateAppointmentAt={(dateStr, timeStr) => openAddModal(dateStr, timeStr)}
            selectedDate={dateFilter}
          />
        ) : (
          <div>
            {/* Board / Card Grid */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-stone-900 rounded-2xl border border-stone-800">
                <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-3" />
                <p className="text-xs font-medium text-stone-400">Loading appointments...</p>
              </div>
            ) : appointments.length === 0 ? (
              <div
                id="empty-state"
                className="flex flex-col items-center justify-center py-16 px-4 text-center bg-stone-900 rounded-2xl border border-dashed border-stone-800"
              >
                <div className="w-12 h-12 rounded-2xl bg-stone-800/80 flex items-center justify-center text-stone-400 mb-3">
                  <CalendarIcon size={24} />
                </div>
                <h3 className="text-base font-semibold text-stone-200">No appointments found</h3>
                <p className="text-xs text-stone-400 max-w-sm mt-1 mb-5">
                  {hasActiveFilters
                    ? 'No appointments match the selected date or status. Try adjusting or clearing your filters.'
                    : 'Your appointment schedule is clear. Click "Book Slot" to add a single or recurring session.'}
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-3.5 py-2 text-xs font-medium text-stone-300 bg-stone-800 hover:bg-stone-700 rounded-xl border border-stone-700 transition-colors cursor-pointer"
                  >
                    Clear all filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAddModal()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Schedule First Appointment</span>
                  </button>
                )}
              </div>
            ) : (
              <div
                id="appointments-container"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {appointments.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    onEdit={openEditModal}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add / Edit Appointment Modal */}
      <AppointmentForm
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAppointment(null);
          setPrefilledDate(undefined);
          setPrefilledTime(undefined);
        }}
        onSubmit={handleSaveAppointment}
        initialAppointment={editingAppointment}
        existingAppointments={appointments}
        prefilledDate={prefilledDate}
        prefilledTime={prefilledTime}
      />

      {/* Supabase Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Supabase Schema & Architecture Modal */}
      {showDbInfoModal && (
        <div
          id="db-info-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDbInfoModal(false);
          }}
        >
          <div className="w-full max-w-2xl bg-stone-900 rounded-2xl shadow-2xl border border-stone-800 overflow-hidden max-h-[90vh] flex flex-col text-stone-200">
            <div className="px-6 py-4 border-b border-stone-800 bg-stone-950/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-amber-400" />
                <h3 className="font-semibold text-sm text-stone-100">
                  Supabase PostgreSQL & Security Architecture
                </h3>
              </div>
              <button
                onClick={() => setShowDbInfoModal(false)}
                className="text-stone-400 hover:text-stone-200 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs text-stone-300 leading-relaxed font-sans">
              {/* Database Status Alert */}
              {dbStatus?.tableExists ? (
                <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <p className="font-semibold text-emerald-200">Supabase Connected & Table Active</p>
                  </div>
                  <p className="text-stone-300 text-xs">
                    The <code className="text-emerald-300 bg-emerald-950/60 px-1 py-0.5 rounded font-mono">appointments</code> table
                    is active in your Supabase project ({dbStatus.projectId || 'configured'}). Changes persist directly to PostgreSQL with Row Level Security.
                  </p>
                </div>
              ) : dbStatus?.isConfigured ? (
                <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-400" />
                      <p className="font-semibold text-amber-200">Action Required: Create 'appointments' Table</p>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400/80 bg-amber-900/40 px-2 py-0.5 rounded-full">
                      PGRST205: Schema not initialized
                    </span>
                  </div>
                  <p className="text-stone-300 text-xs leading-relaxed">
                    Your app is connected to Supabase project <code className="text-amber-300 font-mono bg-stone-900 px-1 py-0.5 rounded">{dbStatus.projectId}</code>,
                    but the database table hasn't been created yet. The app is running with an in-memory store so you can test immediately.
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      <Copy size={13} />
                      <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Schema'}</span>
                    </button>
                    {dbStatus.dashboardSqlUrl && (
                      <a
                        href={dbStatus.dashboardSqlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-200 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg transition-colors cursor-pointer"
                      >
                        <ExternalLink size={13} />
                        <span>Open Supabase SQL Editor</span>
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={checkingDb}
                      onClick={() => loadDbStatus(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-300 bg-stone-900 hover:bg-stone-800 border border-stone-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={checkingDb ? 'animate-spin text-amber-400' : 'text-stone-400'} />
                      <span>{checkingDb ? 'Checking...' : 'Verify Database'}</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* SQL Schema Preview */}
              <div className="bg-stone-950 text-stone-200 p-4 rounded-xl border border-stone-800 overflow-hidden text-[11px] leading-snug">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-amber-400 font-sans text-xs font-semibold">
                    Supabase Schema & Row-Level Security (/schema.sql):
                  </p>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-stone-300 hover:text-stone-100 bg-stone-900 hover:bg-stone-800 border border-stone-700 rounded-lg cursor-pointer"
                  >
                    <Copy size={11} />
                    <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                </div>
                <pre className="font-mono overflow-x-auto p-2 bg-stone-900/70 rounded-lg text-stone-300 max-h-56">{dbStatus?.schemaSql || `-- 1. Create table with user_id and recurrence support
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

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments (user_id);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only view and manage their own appointments" ON appointments;
CREATE POLICY "Users can only view and manage their own appointments"
  ON appointments FOR ALL
  USING (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL))
  WITH CHECK (auth.uid() = user_id OR (user_id IS NULL AND auth.uid() IS NULL));`}</pre>
              </div>

              <div className="p-3.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-300 font-sans space-y-2">
                <p className="font-semibold text-amber-400">Strict Time Conflict Logic:</p>
                <code className="text-xs font-mono bg-stone-900 px-1.5 py-0.5 rounded text-amber-300 border border-stone-800 block">
                  existing.start_time &lt; new.end_time AND existing.end_time &gt; new.start_time
                </code>
                <p className="text-xs text-stone-400">
                  Enforced on both single and recurring bookings. If a slot is Cancelled, it is excluded from conflict checks to free it up for other team bookings.
                </p>
              </div>

              <div className="p-3.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-300 font-sans">
                <p className="font-semibold text-stone-200 mb-1">Environment Variables:</p>
                <p className="text-xs text-stone-400">
                  Configured via <code className="text-amber-300">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
                  <code className="text-amber-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
                  Works out-of-the-box in local development with built-in in-memory fallback store and switches seamlessly to Supabase in production.
                </p>
              </div>
            </div>

            <div className="px-6 py-3 bg-stone-950 border-t border-stone-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDbInfoModal(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-300 bg-stone-800 hover:bg-stone-700 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
