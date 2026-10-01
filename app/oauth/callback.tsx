import { useRouter } from "expo-router";
import { useEffect } from "react";

/** Manus OAuth is retired. Old callback links go to email login. */
export default function OAuthCallback() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
