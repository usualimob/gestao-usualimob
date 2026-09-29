"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

export function DemoAuthForm({ mode }: { mode: "login" | "cadastro" }) {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const isLogin = mode === "login";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseConfigured) { setNotice("Configure as variáveis do Supabase para continuar."); return; }
    const form = new FormData(event.currentTarget);
    setBusy(true); setNotice("");
    try {
      const supabase = createClient();
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
        if (error) throw error;
        router.replace("/dashboard"); router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email: String(form.get("email")), password: String(form.get("password")), options: { data: { name: String(form.get("name")) } } });
        if (error) throw error;
        setNotice("Conta criada. Confirme seu e-mail, se solicitado, e peça autorização à equipe.");
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível autenticar."); }
    finally { setBusy(false); }
  }
  return <main className="auth-wrap"><div className="auth-card">
    <Link href="/dashboard" className="brand"><span className="mark" />gestão<small>imobiliária</small></Link>
    <p className="eyebrow">{supabaseConfigured ? "Acesso da equipe" : "Demonstração"}</p>
    <h1>{isLogin ? "Entrar" : "Criar conta"}</h1>
    <p className="muted">{supabaseConfigured ? isLogin ? "Entre com sua conta autorizada." : "Após criar a conta, um administrador deverá liberar seu acesso à equipe." : "Configure o projeto Supabase para ativar autenticação e operações reais."}</p>
    <form onSubmit={submit}>
      {!isLogin && <label htmlFor="name">Nome<input id="name" name="name" autoComplete="name" required /></label>}
      <label htmlFor="email">E-mail<input id="email" name="email" type="email" autoComplete="email" required /></label>
      <label htmlFor="password">Senha<input id="password" name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required minLength={6} /></label>
      <button className="primary" type="submit" disabled={busy}>{busy ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}</button>
    </form>
    <p className="action-notice" role="status" aria-live="polite">{notice}</p>
    <p className="auth-switch">{isLogin ? "Ainda não tem conta?" : "Já tem conta?"} <Link href={isLogin ? "/cadastro" : "/login"}>{isLogin ? "Ver cadastro" : "Ver login"}</Link></p>
    {!supabaseConfigured && <Link href="/dashboard" className="back-link">Acessar demonstração</Link>}
  </div></main>;
}
