"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

export function PasswordForm({ mode }: { mode: "request" | "update" }) {
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(mode === "request");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "update" || !supabaseConfigured) return;
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, [mode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseConfigured) { setNotice("Configure o Supabase para usar recuperação de senha."); return; }
    const form = new FormData(event.currentTarget);
    setBusy(true); setNotice("");
    try {
      const supabase = createClient();
      if (mode === "request") {
        const { error } = await supabase.auth.resetPasswordForEmail(String(form.get("email")), {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) throw error;
        setNotice("Se o e-mail estiver cadastrado, você receberá um link para definir uma nova senha.");
      } else {
        const password = String(form.get("password"));
        if (password !== form.get("confirm")) throw new Error("As senhas não coincidem.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await supabase.auth.signOut();
        setNotice("Senha atualizada. Entre novamente para continuar.");
        setReady(false);
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  }

  return <main className="auth-wrap"><div className="auth-card">
    <Link href="/login" className="brand">USUALIMOB<small>gestão imobiliária</small></Link>
    <h1>{mode === "request" ? "Esqueci minha senha" : "Definir nova senha"}</h1>
    <p className="muted">{mode === "request" ? "Informe seu e-mail para receber um link de recuperação." : "Abra o link recebido por e-mail e escolha uma nova senha."}</p>
    {(mode === "request" || ready) && <form onSubmit={submit}>
      {mode === "request" ? <label htmlFor="email">E-mail<input id="email" name="email" type="email" autoComplete="email" required /></label> : <>
        <label htmlFor="password">Nova senha<input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label htmlFor="confirm">Confirmar senha<input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
      </>}
      <button className="primary" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "request" ? "Enviar link" : "Salvar senha"}</button>
    </form>}
    {mode === "update" && !ready && !notice && <p className="muted">Aguardando um link válido de recuperação ou convite.</p>}
    <p className="action-notice" role="status" aria-live="polite">{notice}</p>
    <Link href="/login" className="back-link">Voltar ao login</Link>
  </div></main>;
}
