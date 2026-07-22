import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-8">
      <div className="max-w-md border border-text-primary/14 bg-white p-9 text-center">
        <h1 className="mb-2 font-serif text-2xl font-medium tracking-tight">Page not found</h1>
        <p className="mb-6 text-sm text-text-muted">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>
        <Link href="/" className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white">
          Go home
        </Link>
      </div>
    </div>
  );
}
