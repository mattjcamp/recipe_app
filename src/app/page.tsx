import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Entry point: send signed-in users to their lists, others to login.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/lists" : "/login");
}
