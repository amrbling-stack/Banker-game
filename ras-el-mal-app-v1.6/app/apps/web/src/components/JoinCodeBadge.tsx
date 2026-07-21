import { useState } from "react";

interface JoinCodeBadgeProps {
  code: string;
}

export function JoinCodeBadge({ code }: JoinCodeBadgeProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context); the code
      // is already visible on screen, so this is a soft failure.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy join code"
      className="group flex w-full items-center justify-between rounded-card border border-dashed
                 border-gold-600/50 bg-gold-400/10 px-5 py-4 text-left transition
                 active:scale-[0.99]"
    >
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ledger-950/60">
          Join code
        </p>
        <p className="font-mono text-3xl font-medium tracking-[0.15em] text-ledger-950">
          {code}
        </p>
      </div>
      <span className="text-xs font-medium text-gold-600 group-active:text-gold-500">
        {copied ? "Copied" : "Tap to copy"}
      </span>
    </button>
  );
}
