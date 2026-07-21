import type { ReactNode } from "react";

interface PageShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Shared shell for every lobby screen: a compact masthead that echoes the
 * physical kit's cover treatment, then a single centered column that reads
 * comfortably from seat 1 to seat 6 on a phone.
 */
export function PageShell({ eyebrow, title, subtitle, children }: PageShellProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-8">
      <header className="mb-8">
        {eyebrow && (
          <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-gold-600">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-semibold text-ledger-950">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ledger-950/70">{subtitle}</p>}
      </header>
      <main className="flex flex-1 flex-col gap-4">{children}</main>
    </div>
  );
}
