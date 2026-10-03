import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-[20px] font-semibold">Not found</h1>
      <p className="text-muted">This page or account does not exist, or you do not have access to it.</p>
      <Link href="/" className="mt-2 text-accent hover:underline">
        Back to Today
      </Link>
    </main>
  );
}
