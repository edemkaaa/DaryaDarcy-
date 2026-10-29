import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Screen from "@/features/shop/product-screen";
import { PRODUCT_DETAILS as PRODUCTS } from "@/domain/product/catalog";
type Props = {
  params: Promise<{ id: string }>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = PRODUCTS.find((item) => item.id === id);
  return {
    title: product?.title || "Товар не найден",
    description: product?.description,
  };
}
export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!PRODUCTS.some((item) => item.id === id)) notFound();
  return <Screen id={id} />;
}
