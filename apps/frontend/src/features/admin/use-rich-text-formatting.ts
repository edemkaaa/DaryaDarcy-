"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RichTextBlock } from "@/domain/content/types";
import {
  clampRanges,
  toggleRangeFormat,
  truncateSelectionPreview,
} from "@/domain/content/rich-text-edit";
import {
  rangeForOccurrence,
  rangesOverlap,
  selectionOccurrence,
} from "@/domain/content/rich-text-anchors";
import {
  rangesToRichText,
  richTextToRanges,
} from "@/domain/content/rich-text-ranges";
import {
  createEditorRangeAdjuster,
  type TextEditHint,
} from "./editor-range-change";
import { normalizeLinkUrl } from "@/shared/media/photo-aspect-ratios";
function countLinks(blocks: RichTextBlock[] | undefined) {
  if (!blocks?.length) return 0;
  return blocks.reduce(
    (total, block) =>
      total +
      (block.children?.filter((child) => Boolean(child.link)).length ?? 0),
    0,
  );
}
import {
  anchorSelection,
  findRichTextInput,
  normalizeFormatRange,
  normalizeSelection,
  readLiveSelection,
  restoreDomSelection,
  resolveFormatRange,
} from "@/shared/browser/selection";
type Selection = {
  start: number;
  end: number;
};
export function useRichTextFormatting(
  value: string,
  richTextSeed?: RichTextBlock[] | null,
  onRichTextChange?: (blocks: RichTextBlock[] | undefined) => void,
  previewOpen = false,
) {
  const [boldRanges, setBoldRanges] = useState<[number, number][]>([]);
  const [italicRanges, setItalicRanges] = useState<[number, number][]>([]);
  const [linkRanges, setLinkRanges] = useState<
    {
      start: number;
      end: number;
      url: string;
    }[]
  >([]);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState("");
  const [linkModalMode, setLinkModalMode] = useState<"add" | "edit">("add");
  const [inputSelection, setInputSelection] = useState<Selection | null>(null);
  const [activeSelection, setActiveSelection] = useState<Selection | null>(
    null,
  );
  const syncInputSelection = useCallback((next: Selection) => {
    setInputSelection((previous) =>
      previous?.start === next.start && previous.end === next.end
        ? previous
        : next,
    );
  }, []);
  const selectionRef = useRef<Selection>({ start: 0, end: 0 });
  const selectionSnapshotRef = useRef<string>("");
  const activeSelectionRef = useRef<Selection | null>(null);
  // undefined means keyboard activation, with no preceding pointer press.
  const toolbarSelectionRef = useRef<Selection | null | undefined>(undefined);
  const pendingTextEditRef = useRef<TextEditHint | null>(null);
  const prepareTextEdit = useCallback((hint: TextEditHint) => {
    pendingTextEditRef.current = hint;
  }, []);
  const pendingLinkSelectionRef = useRef<Selection>({ start: 0, end: 0 });
  const pendingLinkSnapshotRef = useRef<string>("");
  const pendingLinkOccurrenceRef = useRef(0);
  const selectionUiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const currentTextRef = useRef(value);
  currentTextRef.current = value;
  const prevTextRef = useRef(value);
  const applyingFormatRef = useRef(false);
  const boldRef = useRef(boldRanges);
  const italicRef = useRef(italicRanges);
  const linkRef = useRef(linkRanges);
  useEffect(() => {
    boldRef.current = boldRanges;
  }, [boldRanges]);
  useEffect(() => {
    italicRef.current = italicRanges;
  }, [italicRanges]);
  useEffect(() => {
    linkRef.current = linkRanges;
  }, [linkRanges]);
  useEffect(
    () => () => {
      setLinkModalVisible(false);
      setLinkUrlInput("");
    },
    [],
  );
  const blocksCache = useRef<{
    text: string;
    bold: typeof boldRanges;
    italic: typeof italicRanges;
    links: typeof linkRanges;
    blocks: RichTextBlock[] | undefined;
  } | null>(null);
  const buildRichText = useCallback(
    (
      text: string,
      bold: typeof boldRanges,
      italic: typeof italicRanges,
      links: typeof linkRanges,
    ) => {
      const cached = blocksCache.current;
      if (
        cached &&
        cached.text === text &&
        cached.bold === bold &&
        cached.italic === italic &&
        cached.links === links
      )
        return cached.blocks;
      const blocks = rangesToRichText(text, bold, italic, links);
      blocksCache.current = { text, bold, italic, links, blocks };
      return blocks;
    },
    [],
  );
  const publishRichText = useCallback(
    (
      bold = boldRef.current,
      italic = italicRef.current,
      links = linkRef.current,
      text = value,
    ) => {
      const blocks = buildRichText(text, bold, italic, links);
      onRichTextChange?.(blocks);
      return blocks;
    },
    [buildRichText, onRichTextChange, value],
  );
  useEffect(() => {
    activeSelectionRef.current = activeSelection;
  }, [activeSelection]);
  useEffect(() => {
    if (richTextSeed?.length) {
      const ranges = richTextToRanges(richTextSeed);
      setBoldRanges(ranges.boldRanges);
      setItalicRanges(ranges.italicRanges);
      setLinkRanges(ranges.linkRanges);
      boldRef.current = ranges.boldRanges;
      italicRef.current = ranges.italicRanges;
      linkRef.current = ranges.linkRanges;
    } else {
      setBoldRanges([]);
      setItalicRanges([]);
      setLinkRanges([]);
      boldRef.current = [];
      italicRef.current = [];
      linkRef.current = [];
    }
    setActiveSelection(null);
    setInputSelection(null);
    selectionSnapshotRef.current = "";
    selectionRef.current = { start: 0, end: 0 };
    toolbarSelectionRef.current = undefined;
    prevTextRef.current = currentTextRef.current;
  }, [richTextSeed]);
  const syncActiveSelection = useCallback((next: Selection | null) => {
    activeSelectionRef.current = next;
    setActiveSelection((previous) =>
      previous?.start === next?.start && previous?.end === next?.end
        ? previous
        : next,
    );
  }, []);
  const scheduleSelectionUi = useCallback(
    (next: Selection | null) => {
      if (selectionUiTimerRef.current) {
        clearTimeout(selectionUiTimerRef.current);
        selectionUiTimerRef.current = null;
      }
      {
        syncActiveSelection(next);
        return;
      }
    },
    [syncActiveSelection],
  );
  const flushSelectionUi = useCallback(() => {
    if (selectionUiTimerRef.current) {
      clearTimeout(selectionUiTimerRef.current);
      selectionUiTimerRef.current = null;
    }
    syncActiveSelection(activeSelectionRef.current);
  }, [syncActiveSelection]);
  const handleSelectionChange = useCallback(
    (next: Selection) => {
      if (applyingFormatRef.current) return;
      syncInputSelection(next);
      selectionRef.current = next;
      const normalized = normalizeSelection(value, next);
      if (normalized) {
        const anchored = anchorSelection(value, normalized);
        if (anchored) {
          selectionSnapshotRef.current = anchored.text;
          selectionRef.current = { start: anchored.start, end: anchored.end };
          activeSelectionRef.current = {
            start: anchored.start,
            end: anchored.end,
          };
          scheduleSelectionUi({ start: anchored.start, end: anchored.end });
        }
        return;
      }
      const cursor = Math.min(next.start, next.end);
      const current = activeSelectionRef.current;
      if (current && (cursor < current.start || cursor > current.end)) {
        activeSelectionRef.current = null;
        scheduleSelectionUi(null);
      }
    },
    [scheduleSelectionUi, syncInputSelection, value],
  );
  const clearFormatTarget = useCallback(() => {
    syncActiveSelection(null);
    selectionRef.current = { start: 0, end: 0 };
    toolbarSelectionRef.current = undefined;
  }, [syncActiveSelection]);
  const syncLiveSelection = useCallback(() => {
    const node = findRichTextInput();
    if (node) {
      const next = { start: node.selectionStart, end: node.selectionEnd };
      syncInputSelection(next);
      if (next.start === next.end) {
        selectionRef.current = next;
        selectionSnapshotRef.current = "";
        syncActiveSelection(null);
        return;
      }
    }
    const live = readLiveSelection(value, selectionRef.current);
    if (!live) return;
    selectionRef.current = live;
    selectionSnapshotRef.current = value.slice(live.start, live.end);
    syncActiveSelection(live);
  }, [syncActiveSelection, syncInputSelection, value]);
  const captureSelectionForFormat = useCallback((): Selection | null => {
    const live = readLiveSelection(value, selectionRef.current);
    const fallback = activeSelectionRef.current ?? selectionRef.current;
    const base =
      live ?? (fallback ? normalizeFormatRange(value, fallback) : null);
    if (!base) return null;
    const snapshot = value.slice(base.start, base.end);
    const resolved = resolveFormatRange(value, base, snapshot);
    if (resolved) {
      selectionRef.current = resolved;
      selectionSnapshotRef.current = value.slice(resolved.start, resolved.end);
      syncActiveSelection(resolved);
    }
    return resolved;
  }, [syncActiveSelection, value]);
  const prepareToolbarSelection = useCallback(() => {
    toolbarSelectionRef.current = captureSelectionForFormat();
  }, [captureSelectionForFormat]);
  const cancelToolbarSelection = useCallback(() => {
    toolbarSelectionRef.current = undefined;
  }, []);
  const takeToolbarSelection = useCallback(() => {
    const prepared = toolbarSelectionRef.current;
    toolbarSelectionRef.current = undefined;
    return prepared === undefined ? captureSelectionForFormat() : prepared;
  }, [captureSelectionForFormat]);
  const notifySelectText = useCallback(() => {
    const message = "Сначала выделите нужный фрагмент текста";
    {
      window.alert(message);
      return;
    }
  }, []);
  const handleTextChange = useCallback(
    (nextText: string) => {
      toolbarSelectionRef.current = undefined;
      const node = findRichTextInput();
      if (node) {
        syncInputSelection({
          start: node.selectionStart,
          end: node.selectionEnd,
        });
      }
      const edit = pendingTextEditRef.current;
      pendingTextEditRef.current = null;
      const oldText = prevTextRef.current;
      prevTextRef.current = nextText;
      const adjust = createEditorRangeAdjuster(oldText, nextText, edit);
      const adjustedBold = adjust(boldRef.current);
      const adjustedItalic = adjust(italicRef.current);
      const nextBold =
        adjustedBold === boldRef.current
          ? adjustedBold
          : clampRanges(nextText, adjustedBold);
      const nextItalic =
        adjustedItalic === italicRef.current
          ? adjustedItalic
          : clampRanges(nextText, adjustedItalic);
      const adjustedLinks = linkRef.current
        .map((lr) => {
          const adjusted = adjust([[lr.start, lr.end]]);
          if (adjusted.length === 0) return null;
          const [start, end] = adjusted[0];
          return start === lr.start && end === lr.end
            ? lr
            : { ...lr, start, end };
        })
        .filter((lr): lr is (typeof linkRef.current)[number] => lr !== null);
      const nextLinks =
        adjustedLinks.length === linkRef.current.length &&
        adjustedLinks.every((link, i) => link === linkRef.current[i])
          ? linkRef.current
          : adjustedLinks;
      boldRef.current = nextBold;
      italicRef.current = nextItalic;
      linkRef.current = nextLinks;
      setBoldRanges(nextBold);
      setItalicRanges(nextItalic);
      setLinkRanges(nextLinks);
      publishRichText(nextBold, nextItalic, nextLinks, nextText);
      if (activeSelectionRef.current && selectionSnapshotRef.current) {
        const relocated = resolveFormatRange(
          nextText,
          activeSelectionRef.current,
          selectionSnapshotRef.current,
        );
        syncActiveSelection(relocated);
      }
    },
    [publishRichText, syncActiveSelection, syncInputSelection],
  );
  const beginToggleBold = useCallback(() => {
    flushSelectionUi();
    const sel = takeToolbarSelection();
    if (!sel) {
      notifySelectText();
      return;
    }
    applyingFormatRef.current = true;
    const next = clampRanges(
      value,
      toggleRangeFormat(boldRef.current, sel.start, sel.end),
    );
    boldRef.current = next;
    setBoldRanges(next);
    publishRichText(next, italicRef.current, linkRef.current);
    selectionSnapshotRef.current = value.slice(sel.start, sel.end);
    syncActiveSelection(sel);
    restoreDomSelection(sel.start, sel.end);
    applyingFormatRef.current = false;
  }, [
    takeToolbarSelection,
    flushSelectionUi,
    notifySelectText,
    publishRichText,
    syncActiveSelection,
    value,
  ]);
  const beginToggleItalic = useCallback(() => {
    flushSelectionUi();
    const sel = takeToolbarSelection();
    if (!sel) {
      notifySelectText();
      return;
    }
    applyingFormatRef.current = true;
    const next = clampRanges(
      value,
      toggleRangeFormat(italicRef.current, sel.start, sel.end),
    );
    italicRef.current = next;
    setItalicRanges(next);
    publishRichText(boldRef.current, next, linkRef.current);
    selectionSnapshotRef.current = value.slice(sel.start, sel.end);
    syncActiveSelection(sel);
    restoreDomSelection(sel.start, sel.end);
    applyingFormatRef.current = false;
  }, [
    takeToolbarSelection,
    flushSelectionUi,
    notifySelectText,
    publishRichText,
    syncActiveSelection,
    value,
  ]);
  const resolvePendingLinkRange = useCallback((): Selection | null => {
    const snapshot = pendingLinkSnapshotRef.current;
    if (!snapshot) return null;
    return rangeForOccurrence(
      value,
      snapshot,
      pendingLinkOccurrenceRef.current,
    );
  }, [value]);
  const notifyLinkOverlap = useCallback(() => {
    const message =
      "Новая ссылка пересекается с уже добавленной. Выделите другой фрагмент.";
    {
      window.alert(message);
      return;
    }
  }, []);
  const applyLink = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      const normalized = normalizeLinkUrl(trimmed);
      const resolved = resolvePendingLinkRange();
      if (!resolved) return;
      const { start, end } = resolved;
      const overlapsExisting = linkRef.current.some((link) => {
        const sameRange = link.start === start && link.end === end;
        return !sameRange && rangesOverlap(link, resolved);
      });
      if (overlapsExisting) {
        notifyLinkOverlap();
        return;
      }
      const next = [
        ...linkRef.current.filter(
          (link) => link.end <= start || link.start >= end,
        ),
        { start, end, url: normalized },
      ].sort((a, b) => a.start - b.start || a.end - b.end);
      linkRef.current = next;
      setLinkRanges(next);
      publishRichText(boldRef.current, italicRef.current, next, value);
      setLinkModalVisible(false);
      setLinkUrlInput("");
      pendingLinkSnapshotRef.current = "";
      pendingLinkOccurrenceRef.current = 0;
      selectionSnapshotRef.current = value.slice(start, end);
      syncActiveSelection({ start, end });
      setInputSelection({ start, end });
      restoreDomSelection(start, end);
    },
    [
      notifyLinkOverlap,
      publishRichText,
      resolvePendingLinkRange,
      syncActiveSelection,
      value,
    ],
  );
  const currentLink = inputSelection
    ? (linkRanges.find((link) =>
        inputSelection.start === inputSelection.end
          ? link.start <= inputSelection.start &&
            inputSelection.start < link.end
          : link.start <= inputSelection.start &&
            inputSelection.end <= link.end,
      ) ??
      linkRanges.find(
        (link) =>
          inputSelection.start === inputSelection.end &&
          link.end === inputSelection.start,
      ))
    : undefined;
  const openLinkDialog = useCallback(
    (sel: Selection, url?: string) => {
      const snapshot = value.slice(sel.start, sel.end);
      pendingLinkSelectionRef.current = sel;
      pendingLinkSnapshotRef.current = snapshot;
      pendingLinkOccurrenceRef.current = selectionOccurrence(
        value,
        sel.start,
        sel.end,
      );
      selectionSnapshotRef.current = snapshot;
      setLinkModalMode(url ? "edit" : "add");
      setLinkUrlInput(url ?? "");
      setLinkModalVisible(true);
    },
    [value],
  );
  const beginAddLink = useCallback(() => {
    flushSelectionUi();
    const sel = takeToolbarSelection();
    if (!sel) {
      if (currentLink) openLinkDialog(currentLink, currentLink.url);
      else notifySelectText();
      return;
    }
    const existing = linkRef.current.find(
      (link) => link.start <= sel.start && sel.end <= link.end,
    );
    openLinkDialog(existing ?? sel, existing?.url);
  }, [
    takeToolbarSelection,
    flushSelectionUi,
    notifySelectText,
    currentLink,
    openLinkDialog,
  ]);
  const resetFormatting = useCallback(() => {
    setBoldRanges([]);
    setItalicRanges([]);
    setLinkRanges([]);
    boldRef.current = [];
    italicRef.current = [];
    linkRef.current = [];
    publishRichText([], [], []);
    setActiveSelection(null);
    setInputSelection(null);
    setLinkModalVisible(false);
    setLinkUrlInput("");
    selectionRef.current = { start: 0, end: 0 };
    toolbarSelectionRef.current = undefined;
    prevTextRef.current = value;
  }, [publishRichText, value]);
  const selectedText =
    activeSelection && activeSelection.end > activeSelection.start
      ? value.slice(activeSelection.start, activeSelection.end)
      : "";
  const selectionPreview = selectedText
    ? truncateSelectionPreview(selectedText)
    : "";
  const hasSelection = Boolean(activeSelection);
  const isInBold = hasSelection
    ? boldRanges.some(
        (r) => r[0] <= activeSelection!.start && r[1] >= activeSelection!.end,
      )
    : false;
  const isInItalic = hasSelection
    ? italicRanges.some(
        (r) => r[0] <= activeSelection!.start && r[1] >= activeSelection!.end,
      )
    : false;
  const formatPreview = useMemo(
    () =>
      previewOpen
        ? buildRichText(value, boldRanges, italicRanges, linkRanges)
        : undefined,
    [previewOpen, buildRichText, value, boldRanges, italicRanges, linkRanges],
  );
  const hasFormatting = Boolean(
    boldRanges.length || italicRanges.length || linkRanges.length,
  );
  const syncRangesToValue = useCallback(() => {
    const sourceText = value;
    const oldText = prevTextRef.current;
    if (oldText === sourceText) return;
    const adjust = createEditorRangeAdjuster(oldText, sourceText);
    const adjustedBold = adjust(boldRef.current);
    const adjustedItalic = adjust(italicRef.current);
    const nextBold =
      adjustedBold === boldRef.current
        ? adjustedBold
        : clampRanges(sourceText, adjustedBold);
    const nextItalic =
      adjustedItalic === italicRef.current
        ? adjustedItalic
        : clampRanges(sourceText, adjustedItalic);
    const nextLinks = linkRef.current
      .map((link) => {
        const adjusted = adjust([[link.start, link.end]]);
        if (!adjusted.length) return null;
        const [start, end] = adjusted[0];
        return { ...link, start, end };
      })
      .filter(
        (link): link is (typeof linkRef.current)[number] => link !== null,
      );
    boldRef.current = nextBold;
    italicRef.current = nextItalic;
    linkRef.current = nextLinks;
    prevTextRef.current = sourceText;
  }, [value]);
  const getRichTextBlocks = useCallback(() => {
    syncRangesToValue();
    return buildRichText(
      value,
      boldRef.current,
      italicRef.current,
      linkRef.current,
    );
  }, [buildRichText, syncRangesToValue, value]);
  const getRichTextBlocksForSubmit = useCallback(() => {
    syncRangesToValue();
    const fromRefs = buildRichText(
      value,
      boldRef.current,
      italicRef.current,
      linkRef.current,
    );
    const fromState = buildRichText(
      value,
      boldRanges,
      italicRanges,
      linkRanges,
    );
    const refLinks = countLinks(fromRefs);
    const stateLinks = countLinks(fromState);
    if (stateLinks > refLinks) return fromState ?? fromRefs;
    if (refLinks > stateLinks) return fromRefs ?? fromState;
    return fromRefs ?? fromState ?? formatPreview;
  }, [
    boldRanges,
    buildRichText,
    formatPreview,
    italicRanges,
    linkRanges,
    syncRangesToValue,
    value,
  ]);
  return {
    activeSelection,
    selectedText,
    selectionPreview,
    hasSelection,
    isInBold,
    isInItalic,
    formatPreview,
    getRichTextBlocks,
    getRichTextBlocksForSubmit,
    hasFormatting,
    linkModalVisible,
    linkModalMode,
    linkRanges,
    currentLink,
    linkUrlInput,
    setLinkUrlInput,
    setLinkModalVisible,
    handleSelectionChange,
    handleTextChange,
    prepareTextEdit,
    syncLiveSelection,
    prepareToolbarSelection,
    cancelToolbarSelection,
    flushSelectionUi,
    toggleBold: beginToggleBold,
    toggleItalic: beginToggleItalic,
    addLink: beginAddLink,
    applyLink,
    resetFormatting,
    clearFormatTarget,
  };
}
