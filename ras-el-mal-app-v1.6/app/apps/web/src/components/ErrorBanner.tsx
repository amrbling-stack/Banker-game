interface ErrorBannerProps {
  message: string | null;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-card border border-rose-600/30 bg-rose-600/5 px-4 py-3 text-sm text-rose-600"
    >
      {message}
    </div>
  );
}
