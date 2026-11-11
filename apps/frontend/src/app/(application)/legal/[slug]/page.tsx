/** Вход маршрута /legal/[slug] передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL_DOCUMENTS } from "@/features/legal/legal-documents";
import { LegalDocumentScreen } from "@/features/legal/legal-document-screen";
type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
  return Object.keys(LEGAL_DOCUMENTS).map((slug) => ({ slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: LEGAL_DOCUMENTS[slug]?.title || "Документ не найден" };
}
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const document = Object.hasOwn(LEGAL_DOCUMENTS, slug)
    ? LEGAL_DOCUMENTS[slug]
    : undefined;
  if (!document) notFound();
  return <LegalDocumentScreen document={document} />;
}
