import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-[13px] font-semibold text-accent">404</p>
      <h1 className="text-[20px] font-semibold">This page does not exist, or you have no access to it</h1>
      <Link href="/" className="text-[14px] text-accent underline-offset-4 hover:underline">
        Back to Today
      </Link>
    </main>
  );
}
