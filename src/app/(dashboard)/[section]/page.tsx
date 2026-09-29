import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionView } from "@/components/shared/section-view";
import { LiveSection } from "@/components/shared/live-section";
import { ReportsSection } from "@/components/shared/reports-section";
import { sections } from "@/features/demo/content";

export function generateStaticParams() {
  return sections.map(({ path }) => ({ section: path }));
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section: path } = await params;
  const section = sections.find((item) => item.path === path);
  return { title: section?.heading ?? "Área não encontrada" };
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: path } = await params;
  const section = sections.find((item) => item.path === path);
  if (!section) notFound();
  return process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? path === "relatorios" ? <ReportsSection /> : <LiveSection section={section} />
    : <SectionView section={section} />;
}
