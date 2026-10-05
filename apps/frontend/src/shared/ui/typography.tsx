"use client";
import {
  createContext,
  useContext,
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
const TextContext = createContext(false);
type TypographyProps = Omit<HTMLAttributes<HTMLSpanElement>, "style"> & {
  style?: CSSProperties;
  lines?: number;
  selectable?: boolean;
};
export const Typography = forwardRef<HTMLSpanElement, TypographyProps>(
  function Typography(
    { style, className = "", lines, selectable, children, ...props },
    ref,
  ) {
    const nested = useContext(TextContext);
    return (
      <TextContext.Provider value={true}>
        <span
          ref={ref}
          {...props}
          className={`ui-text ${nested ? "ui-text-inline" : ""} ${className}`}
          style={{
            ...(selectable === false ? { userSelect: "none" } : {}),
            ...(lines === 1
              ? {
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }
              : lines
                ? {
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: lines,
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }
                : {}),
            ...style,
          }}
        >
          {children}
        </span>
      </TextContext.Provider>
    );
  },
);
