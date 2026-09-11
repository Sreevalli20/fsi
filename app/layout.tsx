import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Appointment Board',
  description:
    'A full-stack appointment board for teams with monthly/weekly/daily calendar views, recurring appointments generator, time conflict prevention, and Supabase Auth data protection.',
  openGraph: {
    title: 'Appointment Board',
    description:
      'A full-stack appointment board for teams with monthly/weekly/daily calendar views, recurring appointments generator, time conflict prevention, and Supabase Auth data protection.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-stone-950 text-stone-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
