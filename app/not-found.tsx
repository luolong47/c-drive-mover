import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-2xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
        Page Not Found
      </h2>
      <p className="text-zinc-500 dark:text-zinc-400 mb-6">Could not find requested resource</p>
      <Link
        href="/"
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
