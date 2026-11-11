/** Вход маршрута /shop/[id] передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Screen from "@/features/shop/product-screen";
import { PRODUCT_DETAILS as PRODUCTS } from "@/domain/product/catalog";
type Props = {
  params: Promise<{ id: string }>;
};
/** Метаданные берём из того же локального каталога, что проверяет Page, не выполняя отдельный запрос товара. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = PRODUCTS.find((item) => item.id === id);
  return {
    title: product?.title || "Товар не найден",
    description: product?.description,
  };
}
/** Ждём параметры Next и отклоняем отсутствующий товар до клиентского рендера; каталог здесь тот же, что у витрины. */
export default async function Page({ params }: Props) {
  const { id } = await params;
  if (!PRODUCTS.some((item) => item.id === id)) notFound();
  return <Screen id={id} />;
}
