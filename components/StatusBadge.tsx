import React from 'react';
import { AppointmentStatus } from '@/types/appointment';
import { Clock, CheckCircle2, Ban } from 'lucide-react';

interface StatusBadgeProps {
  status: AppointmentStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  const iconSize = size === 'sm' ? 12 : 14;

  switch (status) {
    case 'Scheduled':
      return (
        <span
          id={`status-badge-${status.toLowerCase()}`}
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 ${sizeClasses}`}
        >
          <Clock size={iconSize} className="text-blue-600 dark:text-blue-400" />
          <span>Scheduled</span>
        </span>
      );

    case 'Completed':
      return (
        <span
          id={`status-badge-${status.toLowerCase()}`}
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 ${sizeClasses}`}
        >
          <CheckCircle2 size={iconSize} className="text-emerald-600 dark:text-emerald-400" />
          <span>Completed</span>
        </span>
      );

    case 'Cancelled':
      return (
        <span
          id={`status-badge-${status.toLowerCase()}`}
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-stone-100 text-stone-600 border border-stone-200 dark:bg-stone-900/60 dark:text-stone-400 dark:border-stone-800 ${sizeClasses}`}
        >
          <Ban size={iconSize} className="text-stone-500 dark:text-stone-400" />
          <span>Cancelled</span>
        </span>
      );

    default:
      return null;
  }
}
