import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";

export function TopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/dashboard">Dashboard</Link></Button>
              <Button asChild variant="ghost" size="sm"><Link to="/chat">Coach</Link></Button>
              <Button
                variant="ghost" size="icon"
                onClick={async () => { await supabase.auth.signOut(); navigate("/"); }}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
              <Button asChild variant="default" size="sm"><Link to="/auth?mode=signup">Get started</Link></Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
