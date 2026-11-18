import Link from "next/link";
export default async function WaitingPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const failed = (await searchParams).erro === "consulta";
  return <main className="auth-wrap"><div className="auth-card">
    <p className="eyebrow">Acesso da equipe</p><h1>{failed ? "Falha ao verificar acesso" : "Aguardando autorização"}</h1>
    <p className="muted">{failed ? "Não foi possível consultar as permissões da equipe. Verifique se os scripts de acesso foram aplicados no Supabase." : "Sua conta ainda não foi incluída na equipe ou foi desativada. Peça ao administrador para liberar seu usuário no Supabase."}</p>
    <Link href="/login" className="button-link">Voltar ao login</Link>
  </div></main>;
}
