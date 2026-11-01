"use client";
import React, { forwardRef, type CSSProperties } from "react";
type FieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "onSelect" | "onFocus" | "onKeyDown" | "style" | "size"
> & {
  style?: CSSProperties;
  onFocus?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<
    HTMLInputElement | HTMLTextAreaElement
  >;
  multiline?: boolean;
  onValueChange?: (value: string) => void;
  onSelection?: (selection: { start: number; end: number }) => void;
  onSubmit?: () => void;
  placeholderColor?: string;
  selectOnFocus?: boolean;
  rows?: number;
};
export const Field = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  FieldProps
>(function Field(
  {
    multiline,
    onValueChange,
    onSelection,
    onSubmit,
    placeholderColor,
    selectOnFocus,
    style,
    className = "",
    onFocus,
    ...props
  },
  ref,
) {
  const shared = {
    ...props,
    className: `ui-field ${className}`,
    style: {
      "--placeholder-color": placeholderColor,
      ...style,
    } as CSSProperties,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onValueChange?.(e.currentTarget.value),
    onSelect: (
      e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) =>
      onSelection?.({
        start: e.currentTarget.selectionStart || 0,
        end: e.currentTarget.selectionEnd || 0,
      }),
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (selectOnFocus) e.currentTarget.select();
      onFocus?.(e);
    },
    onKeyDown: (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      props.onKeyDown?.(e);
      if (
        e.key === "Enter" &&
        !multiline &&
        onSubmit &&
        !e.defaultPrevented &&
        !e.nativeEvent.isComposing &&
        // Some IMEs report Enter with keyCode 229 after isComposing clears.
        e.nativeEvent.keyCode !== 229
      ) {
        e.preventDefault();
        onSubmit?.();
      }
    },
  };
  return multiline ? (
    <textarea
      {...(shared as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      ref={ref as React.Ref<HTMLTextAreaElement>}
    />
  ) : (
    <input {...shared} ref={ref as React.Ref<HTMLInputElement>} />
  );
});
