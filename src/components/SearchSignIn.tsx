import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import "@lovable.dev/cloud-auth-js/styles.css";

export function SearchSignIn({ onChange }: { onChange: (signedIn: boolean) => void }) {
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const update = (value: boolean) => { if (active) { setSignedIn(value); onChange(value); } };
    void supabase.auth.getSession().then(({ data }) => update(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => update(Boolean(session)));
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [onChange]);
  if (signedIn) return null;
  return <div className="mt-4 text-center">
    <button type="button" className="lovable-auth-button" onClick={async () => {
      const result = await lovable.auth.signInWithOAuth("lovable", { redirect_uri: window.location.origin });
      if (result.error) setError("Couldn't sign in. Please try again.");
    }}>Continue with Lovable</button>
    {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
  </div>;
}