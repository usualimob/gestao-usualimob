"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { sections } from "@/features/demo/content";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

export function AppShell({ children, isAdmin = false }: { children: React.ReactNode; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [menuOpen, setMenuOpen] = useState(false);

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
    <button type="button" className="sidebar-toggle" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} aria-controls="app-sidebar" onClick={() => setMenuOpen(!menuOpen)}><span className="material-symbols-outlined" aria-hidden="true">{menuOpen ? "close" : "menu"}</span></button>
    {menuOpen && <button type="button" className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
    <aside id="app-sidebar" className={`site-sidebar${menuOpen ? " open" : ""}`}>
      <Link href="/dashboard" className="brand" onClick={() => setMenuOpen(false)} aria-label="Usualimob Gestão Imobiliária, início">USUALIMOB<small>gestão imobiliária</small></Link>
      <nav aria-label="Áreas do sistema">
        {isAdmin && <Link href="/equipe" onClick={() => setMenuOpen(false)} aria-current={pathname === "/equipe" ? "page" : undefined} className={pathname === "/equipe" ? "active" : ""}>Administração</Link>}
        {sections.map((section) => <Link key={section.path} href={`/${section.path}`} onClick={() => setMenuOpen(false)} aria-current={pathname === `/${section.path}` ? "page" : undefined} className={pathname === `/${section.path}` ? "active" : ""}>{section.label}</Link>)}
      </nav>
      <div className="sidebar-actions"><button type="button" id="theme-toggle" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}><span className="material-symbols-outlined" aria-hidden="true">{theme === "dark" ? "light_mode" : "dark_mode"}</span><span>Tema</span></button>
      {supabaseConfigured ? <button type="button" className="header-link signout" onClick={async () => { await createClient().auth.signOut(); window.location.assign("/login"); }}>Sair</button> : <Link href="/login" className="header-link">Login</Link>}</div>
    </aside>
    <main id="conteudo">{children}</main>
  </>;
}
