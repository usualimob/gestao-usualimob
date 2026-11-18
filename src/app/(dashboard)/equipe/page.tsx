import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeamManager } from "@/components/shared/team-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipe" };

export default async function TeamPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return <section className="panel"><h1>Equipe</h1><p>Configure o Supabase para gerenciar usuários.</p></section>;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("equipe_usuarios").select("papel,ativo").eq("user_id", user.id).maybeSingle();
  if (me?.papel !== "admin" || !me.ativo) redirect("/dashboard");
  const { data: members, error } = await supabase.from("equipe_usuarios")
    .select("user_id,nome,email,papel,ativo,pode_editar").order("criado_em");
  if (error) return <p role="alert">Não foi possível carregar a equipe: {error.message}</p>;
  return <TeamManager members={members ?? []} currentId={user.id} />;
}
