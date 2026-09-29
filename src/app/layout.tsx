import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Gestão Imobiliária", template: "%s | Gestão Imobiliária" },
  description: "Gestão imobiliária da equipe.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" data-theme="dark"><body>{children}</body></html>;
}
