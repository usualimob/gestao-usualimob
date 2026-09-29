"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { sections } from "@/features/demo/content";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("tema");
    if (saved === "dark" || saved === "light") {
      document.documentElement.dataset.theme = saved;
      setTheme(saved);
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("tema", next);
    setTheme(next);
  }

  return <>
    <header className="site-header">
      <Link href="/dashboard" className="brand" aria-label="Gestão Imobiliária, início"><span className="mark" />gestão<small>imobiliária</small></Link>
      <nav aria-label="Áreas do sistema">
        {sections.map((section) => <Link key={section.path} href={`/${section.path}`} aria-current={pathname === `/${section.path}` ? "page" : undefined} className={pathname === `/${section.path}` ? "active" : ""}>{section.label}</Link>)}
      </nav>
      <button type="button" id="theme-toggle" onClick={toggleTheme} aria-label={`Ativar tema ${theme === "dark" ? "claro" : "escuro"}`} title="Alternar tema">{theme === "dark" ? "☀" : "☾"}</button>
      {supabaseConfigured ? <button type="button" className="header-link signout" onClick={async () => { await createClient().auth.signOut(); window.location.assign("/login"); }}>Sair</button> : <Link href="/login" className="header-link">Login</Link>}
    </header>
    <main id="conteudo">{children}</main>
  </>;
}
