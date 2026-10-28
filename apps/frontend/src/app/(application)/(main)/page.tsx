import Screen from "@/features/home/home-screen";
// The public landing page is cached; browser calendar state updates after hydration.
export const revalidate = 3600;
export default function Page() {
  return <Screen initialDate={new Date().toISOString()} />;
}
