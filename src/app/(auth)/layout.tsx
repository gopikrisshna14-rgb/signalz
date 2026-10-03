import { Radar } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-2 font-semibold">
          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Radar size={16} />
          </span>
          Hiring Signals
        </div>
        {children}
      </div>
    </main>
  );
}
