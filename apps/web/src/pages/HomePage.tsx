import { Link } from "react-router-dom";
import { PageShell } from "@/components/PageShell";

export function HomePage() {
  return (
    <PageShell
      eyebrow="Ras El-Mal · رأس المال"
      title="The digital banker"
      subtitle="Board, dice, and cards stay on the table. This app handles the money."
    >
      <Link to="/create" className="btn-primary">
        Host a new game
      </Link>
      <Link to="/join" className="btn-secondary">
        Join with a code
      </Link>

      <p className="mt-6 text-center text-xs text-ledger-950/50">
        مش مهم تشتري إيه... المهم تشتري إمتى
      </p>
    </PageShell>
  );
}
