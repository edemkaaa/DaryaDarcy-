"use client";
/** Редактор тегов использует единые значения рубрик, сохраняя подписи отдельно от передаваемых API значений. */
import { memo } from "react";
import { Action, Typography } from "@/shared/ui/elements";
import type { PostTag } from "@/domain/post/post-tags";
import full from "./admin-screen.module.scss";
import quick from "./create-post-modal.module.scss";

const variants = {
  full: {
    section: full.formGroup,
    label: full.formLabel,
    grid: full.tagsGrid,
    chip: full.tagChipRubricSelected,
    rubricSelected: full.appearanceState,
    selected: full.appearanceState2,
    rubricIdle: full.appearanceState3,
    idle: full.appearanceState4,
    rubricBorder: full.borderWidthState,
    border: full.borderWidthState2,
    rubricText: full.appearanceState5,
    text: full.appearanceState6,
    selectedColor: full.colorState7,
    color: full.colorState8,
  },
  quick: {
    section: quick.section,
    label: quick.sectionLabel,
    grid: quick.tagsGrid,
    chip: quick.tagChipRubricSelected,
    rubricSelected: quick.appearanceState5,
    selected: quick.appearanceState6,
    rubricIdle: quick.appearanceState7,
    idle: quick.appearanceState8,
    rubricBorder: quick.borderWidthState,
    border: quick.borderWidthState2,
    rubricText: quick.appearanceState9,
    text: quick.appearanceState10,
    selectedColor: quick.colorState5,
    color: quick.colorState6,
  },
};

/** Text/caret updates must not rebuild all the tag buttons. */
export const PostEditorTags = memo(function PostEditorTags({
  variant,
  availableTags,
  selectedTags,
  onToggle,
}: {
  variant: keyof typeof variants;
  availableTags: readonly PostTag[];
  selectedTags: readonly string[];
  onToggle: (slug: string) => void;
}) {
  // Мемоизированная группа тегов сохраняет серверные slug и русские подписи; ввод текста не должен заново строить все кнопки.

  const styles = variants[variant];
  return (
    <div className={`ui-stack ${styles.section}`}>
      <Typography className={styles.label}>Метки</Typography>
      <div className={`ui-stack ${styles.grid}`}>
        {availableTags.map((tag) => {
          const selected = selectedTags.includes(tag.slug);
          return (
            <Action
              key={tag.slug}
              onClick={() => onToggle(tag.slug)}
              className={[
                styles.chip,
                tag.rubric && selected
                  ? styles.rubricSelected
                  : selected
                    ? styles.selected
                    : tag.rubric
                      ? styles.rubricIdle
                      : styles.idle,
                tag.rubric ? styles.rubricBorder : styles.border,
              ].join(" ")}
            >
              <Typography
                className={[
                  tag.rubric ? styles.rubricText : styles.text,
                  selected ? styles.selectedColor : styles.color,
                ].join(" ")}
              >
                {tag.label}
              </Typography>
            </Action>
          );
        })}
      </div>
    </div>
  );
});
