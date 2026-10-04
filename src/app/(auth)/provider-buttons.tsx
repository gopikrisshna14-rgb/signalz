import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enabledProviders } from "@/lib/auth/providers";
import { loginWithProvider } from "./actions";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden>
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}

export function ProviderButtons({ callbackUrl }: { callbackUrl: string }) {
  const p = enabledProviders();
  const any = p.google || p.microsoft || p.demo;
  if (!any) return null;
  return (
    <div className="space-y-2">
      {p.demo ? (
        <form action={loginWithProvider}>
          <input type="hidden" name="provider" value="demo" />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Button type="submit" variant="primary" size="lg" className="w-full">
            <Sparkles size={16} /> Continue with demo account
          </Button>
        </form>
      ) : null}
      {p.google ? (
        <form action={loginWithProvider}>
          <input type="hidden" name="provider" value="google" />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Button type="submit" size="lg" className="w-full">
            <GoogleIcon /> Continue with Google
          </Button>
        </form>
      ) : null}
      {p.microsoft ? (
        <form action={loginWithProvider}>
          <input type="hidden" name="provider" value="microsoft-entra-id" />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Button type="submit" size="lg" className="w-full">
            <MicrosoftIcon /> Continue with Microsoft
          </Button>
        </form>
      ) : null}
      <div className="flex items-center gap-3 py-2 text-[12px] text-muted">
        <span className="h-px flex-1 bg-line" /> or with e-mail <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
