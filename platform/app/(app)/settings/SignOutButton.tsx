"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { createClient } from "@/utils/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handle = async () => {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="destructive"
      onClick={handle}
      loading={pending}
    >
      <LogOut size={16} strokeWidth={1.85} />
      Sign out
    </Button>
  );
}
