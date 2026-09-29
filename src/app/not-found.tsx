import Link from "next/link";

export default function NotFound() {
  return <main className="auth-wrap"><div className="auth-card"><h1>Página não encontrada</h1><p className="muted">Confira o endereço e tente novamente.</p><Link href="/dashboard" className="button-link">Ir ao dashboard</Link></div></main>;
}
