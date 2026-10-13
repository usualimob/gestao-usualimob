"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { sections } from "@/features/demo/content";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  function applyTheme(next: "dark" | "light") {
    document.documentElement.dataset.theme = next;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-app-theme]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.dataset.appTheme = "true";
      document.head.append(meta);
    }
    meta.content = next === "dark" ? "#111412" : "#202523";
  }

  useEffect(() => {
    const saved = localStorage.getItem("tema");
    if (saved === "dark" || saved === "light") {
      applyTheme(saved);
      setTheme(saved);
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("tema", next);
    setTheme(next);
  }
  const themeLabel = `Ativar tema ${theme === "dark" ? "claro" : "escuro"}`;

  return <>
    <header className="site-header">
      <Link href="/dashboard" className="brand" aria-label="Usualimob Gestão Imobiliária, início">USUALIMOB<small>gestão imobiliária</small></Link>
      <nav aria-label="Áreas do sistema">
        {sections.map((section) => <Link key={section.path} href={`/${section.path}`} aria-current={pathname === `/${section.path}` ? "page" : undefined} className={pathname === `/${section.path}` ? "active" : ""}>{section.label}</Link>)}
      </nav>
      <button type="button" id="theme-toggle" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}><span className="material-symbols-outlined" aria-hidden="true">{theme === "dark" ? "light_mode" : "dark_mode"}</span></button>
      {supabaseConfigured ? <button type="button" className="header-link signout" onClick={async () => { await createClient().auth.signOut(); window.location.assign("/login"); }}>Sair</button> : <Link href="/login" className="header-link">Login</Link>}
    </header>
    <main id="conteudo">{children}</main>
  </>;
}
