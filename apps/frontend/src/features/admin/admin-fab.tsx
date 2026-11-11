"use client";
/** Быстрые административные действия доступны из общего плавающего меню и передают создание материалов отдельным редакторам. */
import classes from "./admin-fab.module.scss";
import { Action } from "@/shared/ui/elements";
import { useState } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { useAuth } from "@/domain/session/session-context";
import { useRouter } from "@/shared/navigation/router";
import dynamic from "next/dynamic";
const CreatePostModal = dynamic(
  () => import("./create-post-modal").then((m) => m.CreatePostModal),
  { ssr: false },
);
import { ACCENT, CREAM_BG } from "./admin-fab.content";
type Target = "feed" | "club" | "both";
interface AdminFABProps {
  target: Target;
}
export function AdminFAB({ target }: AdminFABProps) {
  const { isOwner } = useAuth();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  if (!isOwner) return null;
  const handlePress = () => {
    setShowCreate(true);
  };
  const openAdmin = () => {
    router.push("/admin");
  };
  return (
    <>
      <div
        className={["ui-stack  ui-pointer-children", classes.stack]
          .filter(Boolean)
          .join(" ")}
      >
        <Action
          onClick={openAdmin}
          aria-label="Открыть админку"
          className={({ pressed }) =>
            [
              classes.fabPressed,
              pressed ? classes.transformState : "",
              pressed ? classes.opacityState : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <MaterialIcons name="settings" size={22} color={ACCENT} />
        </Action>
        <Action
          onClick={handlePress}
          onHold={openAdmin}
          holdDelay={500}
          aria-label="Новый пост"
          className={({ pressed }) =>
            [
              classes.fabPressed2,
              pressed ? classes.transformState2 : "",
              pressed ? classes.opacityState2 : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <MaterialIcons name="add" size={28} color={CREAM_BG} />
        </Action>
      </div>

      {showCreate && (
        <CreatePostModal
          visible
          onClose={() => setShowCreate(false)}
          defaultTarget={target}
        />
      )}
    </>
  );
}
