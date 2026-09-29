import Link from "next/link";
export default function WaitingPage() {
  return <main className="auth-wrap"><div className="auth-card">
    <p className="eyebrow">Acesso da equipe</p><h1>Aguardando autorização</h1>
    <p className="muted">Sua conta ainda não foi incluída na equipe. Peça ao administrador para liberar seu usuário no Supabase.</p>
    <Link href="/login" className="button-link">Voltar ao login</Link>
  </div></main>;
}
