import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Usualimob Gestão Imobiliária", template: "%s | Usualimob" },
  description: "Gestão imobiliária Usualimob.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#202523" },
    { media: "(prefers-color-scheme: dark)", color: "#111412" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" data-theme="dark"><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=add_task,arrow_back,arrow_forward,block,close,dark_mode,delete,edit,event_available,light_mode,payments,send,task_alt,undo&display=block" /></head><body>{children}</body></html>;
}
