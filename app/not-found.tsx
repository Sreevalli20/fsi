import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-stone-50 text-stone-900">
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-sm text-stone-500 mb-6">The page or appointment you are looking for does not exist.</p>
      <Link
        href="/"
        className="px-4 py-2 text-sm font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors"
      >
        Return to Appointment Board
      </Link>
    </div>
  );
}
