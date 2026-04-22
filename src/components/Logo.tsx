import { Activity } from "lucide-react";
import { Link } from "react-router-dom";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 font-serif text-xl tracking-tight ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-soft">
        <Activity className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <span>EvidenceFit</span>
    </Link>
  );
}
