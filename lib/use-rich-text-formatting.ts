import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import type { RichTextBlock } from "@/components/rich-text-renderer";
import {
  adjustRangesOnTextChange,
  clampRanges,
  toggleRangeFormat,
  truncateSelectionPreview,
} from "@/lib/rich-text-edit";
import { rangeForOccurrence, rangesOverlap, selectionOccurrence } from "@/lib/rich-text-anchors";
import { rangesToRichText, richTextToRanges } from "@/lib/rich-text-ranges";
import { normalizeLinkUrl } from "@/lib/photo-aspect-ratios";

function countLinks(blocks: RichTextBlock[] | undefined) {
  if (!blocks?.length) return 0;
  return blocks.reduce(
    (total, block) => total + (block.children?.filter((child) => Boolean(child.link)).length ?? 0),
    0,
  );
}

export function runAfterSelectionReady(run: () => void) {
  if (Platform.OS === "web") {
    requestAnimationFrame(() => requestAnimationFrame(run));
    return;
  }
  run();
}

import {
  anchorSelection,
  normalizeFormatRange,
  normalizeSelection,
  readLiveSelection,
  restoreDomSelection,
  resolveFormatRange,
} from "@/lib/selection";

type Selection = { start: number; end: number };

export function useRichTextFormatting(
  value: string,
  richTextSeed?: RichTextBlock[] | null,
  onRichTextChange?: (blocks: RichTextBlock[] | undefined) => void,
) {
  const [boldRanges, setBoldRanges] = useState<[number, number][]>([]);
  const [italicRanges, setItalicRanges] = useState<[number, number][]>([]);
  const [linkRanges, setLinkRanges] = useState<{ start: number; end: number; url: string }[]>([]);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState("");
  const [activeSelection, setActiveSelection] = useState<Selection | null>(null);

  const selectionRef = useRef<Selection>({ start: 0, end: 0 });
  const selectionSnapshotRef = useRef<string>("");
  const activeSelectionRef = useRef<Selection | null>(null);
  const pendingLinkSelectionRef = useRef<Selection>({ start: 0, end: 0 });
  const pendingLinkSnapshotRef = useRef<string>("");
  const pendingLinkOccurrenceRef = useRef(0);
  const selectionUiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const publishRichText = useCallback(
    (
      bold = boldRef.current,
      italic = italicRef.current,
      links = linkRef.current,
      text = value,
    ) => {
      const blocks = rangesToRichText(text, bold, italic, links);
      onRichTextChange?.(blocks);
      return blocks;
    },
    [onRichTextChange, value],
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
    selectionSnapshotRef.current = "";
    selectionRef.current = { start: 0, end: 0 };
    prevTextRef.current = value;
  }, [richTextSeed]);

  const syncActiveSelection = useCallback(
    (next: Selection | null) => {
      activeSelectionRef.current = next;
      setActiveSelection(next);
    },
    [],
  );

  const scheduleSelectionUi = useCallback(
    (next: Selection | null) => {
      if (selectionUiTimerRef.current) {
        clearTimeout(selectionUiTimerRef.current);
        selectionUiTimerRef.current = null;
      }
      if (Platform.OS === "web") {
        syncActiveSelection(next);
        return;
      }
      selectionUiTimerRef.current = setTimeout(() => {
        syncActiveSelection(next);
        selectionUiTimerRef.current = null;
      }, 350);
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
      selectionRef.current = next;
      const normalized = normalizeSelection(value, next);
      if (normalized) {
        const anchored = anchorSelection(value, normalized);
        if (anchored) {
          selectionSnapshotRef.current = anchored.text;
          selectionRef.current = { start: anchored.start, end: anchored.end };
          activeSelectionRef.current = { start: anchored.start, end: anchored.end };
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
    [scheduleSelectionUi, value],
  );

  const clearFormatTarget = useCallback(() => {
    syncActiveSelection(null);
    selectionRef.current = { start: 0, end: 0 };
  }, [syncActiveSelection]);

  const syncLiveSelection = useCallback(() => {
    const live = readLiveSelection(value, selectionRef.current);
    if (!live) return;
    selectionRef.current = live;
    selectionSnapshotRef.current = value.slice(live.start, live.end);
    syncActiveSelection(live);
  }, [syncActiveSelection, value]);

  const captureSelectionForFormat = useCallback((): Selection | null => {
    const live = readLiveSelection(value, selectionRef.current);
    const fallback = activeSelectionRef.current ?? selectionRef.current;
    const base = live ?? (fallback ? normalizeFormatRange(value, fallback) : null);
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

  const notifySelectText = useCallback(() => {
    const message = "Сначала выделите нужный фрагмент текста";
    if (Platform.OS === "web") {
      window.alert(message);
      return;
    }
    Alert.alert("Форматирование", message);
  }, []);

  const handleTextChange = useCallback(
    (nextText: string) => {
      const oldText = prevTextRef.current;
      prevTextRef.current = nextText;
      const nextBold = clampRanges(nextText, adjustRangesOnTextChange(oldText, nextText, boldRef.current));
      const nextItalic = clampRanges(nextText, adjustRangesOnTextChange(oldText, nextText, italicRef.current));
      const nextLinks = linkRef.current
        .map((lr) => {
          const adjusted = adjustRangesOnTextChange(oldText, nextText, [[lr.start, lr.end]]);
          if (adjusted.length === 0) return null;
          const [start, end] = adjusted[0];
          return { ...lr, start, end };
        })
        .filter((lr): lr is (typeof linkRef.current)[number] => lr !== null);

      const recoveredLinks = [...nextLinks];
      const seenLinks = new Set(nextLinks.map((link) => `${link.start}:${link.end}:${link.url}`));
      for (const old of linkRef.current) {
        const kept = nextLinks.some(
          (link) => link.start === old.start && link.end === old.end && link.url === old.url,
        );
        if (kept) continue;
        const anchor = oldText.slice(old.start, old.end);
        if (!anchor) continue;
        const occurrence = selectionOccurrence(oldText, old.start, old.end);
        const relocated = rangeForOccurrence(nextText, anchor, occurrence);
        if (!relocated) continue;
        const key = `${relocated.start}:${relocated.end}:${old.url}`;
        if (seenLinks.has(key)) continue;
        if (recoveredLinks.some((link) => rangesOverlap(link, relocated))) continue;
        recoveredLinks.push({ ...relocated, url: old.url });
        seenLinks.add(key);
      }
      recoveredLinks.sort((a, b) => a.start - b.start || a.end - b.end);

      boldRef.current = nextBold;
      italicRef.current = nextItalic;
      linkRef.current = recoveredLinks;
      setBoldRanges(nextBold);
      setItalicRanges(nextItalic);
      setLinkRanges(recoveredLinks);
      publishRichText(nextBold, nextItalic, recoveredLinks, nextText);

      if (activeSelectionRef.current && selectionSnapshotRef.current) {
        const relocated = resolveFormatRange(
          nextText,
          activeSelectionRef.current,
          selectionSnapshotRef.current,
        );
        syncActiveSelection(relocated);
      }
    },
    [publishRichText, syncActiveSelection],
  );

  const beginToggleBold = useCallback(() => {
    flushSelectionUi();
    syncLiveSelection();
    const sel = captureSelectionForFormat();
    if (!sel) {
      notifySelectText();
      return;
    }
    applyingFormatRef.current = true;
    setBoldRanges((prev) => {
      const next = clampRanges(value, toggleRangeFormat(prev, sel.start, sel.end));
      boldRef.current = next;
      publishRichText(next, italicRef.current, linkRef.current);
      return next;
    });
    selectionSnapshotRef.current = value.slice(sel.start, sel.end);
    syncActiveSelection(sel);
    restoreDomSelection(sel.start, sel.end);
    applyingFormatRef.current = false;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [captureSelectionForFormat, flushSelectionUi, notifySelectText, publishRichText, syncActiveSelection, syncLiveSelection, value]);

  const toggleBold = useCallback(() => {
    runAfterSelectionReady(beginToggleBold);
  }, [beginToggleBold]);

  const beginToggleItalic = useCallback(() => {
    flushSelectionUi();
    syncLiveSelection();
    const sel = captureSelectionForFormat();
    if (!sel) {
      notifySelectText();
      return;
    }
    applyingFormatRef.current = true;
    setItalicRanges((prev) => {
      const next = clampRanges(value, toggleRangeFormat(prev, sel.start, sel.end));
      italicRef.current = next;
      publishRichText(boldRef.current, next, linkRef.current);
      return next;
    });
    selectionSnapshotRef.current = value.slice(sel.start, sel.end);
    syncActiveSelection(sel);
    restoreDomSelection(sel.start, sel.end);
    applyingFormatRef.current = false;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [captureSelectionForFormat, flushSelectionUi, notifySelectText, publishRichText, syncActiveSelection, syncLiveSelection, value]);

  const toggleItalic = useCallback(() => {
    runAfterSelectionReady(beginToggleItalic);
  }, [beginToggleItalic]);

  const resolvePendingLinkRange = useCallback((): Selection | null => {
    const snapshot = pendingLinkSnapshotRef.current;
    if (!snapshot) return null;
    return rangeForOccurrence(value, snapshot, pendingLinkOccurrenceRef.current);
  }, [value]);

  const notifyLinkOverlap = useCallback(() => {
    const message = "Новая ссылка пересекается с уже добавленной. Выделите другой фрагмент.";
    if (Platform.OS === "web") {
      window.alert(message);
      return;
    }
    Alert.alert("Ссылка", message);
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
      setLinkRanges((prev) => {
        const next = [
          ...prev.filter((link) => link.end <= start || link.start >= end),
          { start, end, url: normalized },
        ];
        linkRef.current = next;
        publishRichText(boldRef.current, italicRef.current, next, value);
        return next;
      });
      setLinkModalVisible(false);
      setLinkUrlInput("");
      pendingLinkSnapshotRef.current = "";
      pendingLinkOccurrenceRef.current = 0;
      selectionSnapshotRef.current = value.slice(start, end);
      syncActiveSelection({ start, end });
      restoreDomSelection(start, end);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [notifyLinkOverlap, publishRichText, resolvePendingLinkRange, syncActiveSelection, value],
  );

  const beginAddLink = useCallback(() => {
    flushSelectionUi();
    syncLiveSelection();
    const sel = captureSelectionForFormat();
    if (!sel) {
      notifySelectText();
      return;
    }
    const snapshot = value.slice(sel.start, sel.end);
    pendingLinkSelectionRef.current = sel;
    pendingLinkSnapshotRef.current = snapshot;
    pendingLinkOccurrenceRef.current = selectionOccurrence(value, sel.start, sel.end);
    selectionSnapshotRef.current = snapshot;
    if (Platform.OS === "ios" && typeof Alert.prompt === "function") {
      Alert.prompt("Ссылка", "Введите URL", (url) => {
        if (url) applyLink(url);
      });
      return;
    }
    setLinkUrlInput("");
    setLinkModalVisible(true);
  }, [applyLink, captureSelectionForFormat, flushSelectionUi, notifySelectText, syncLiveSelection, value]);

  const addLink = useCallback(() => {
    runAfterSelectionReady(beginAddLink);
  }, [beginAddLink]);

  const resetFormatting = useCallback(() => {
    setBoldRanges([]);
    setItalicRanges([]);
    setLinkRanges([]);
    boldRef.current = [];
    italicRef.current = [];
    linkRef.current = [];
    publishRichText([], [], []);
    setActiveSelection(null);
    setLinkModalVisible(false);
    setLinkUrlInput("");
    selectionRef.current = { start: 0, end: 0 };
    prevTextRef.current = value;
  }, [publishRichText, value]);

  const selectedText =
    activeSelection && activeSelection.end > activeSelection.start
      ? value.slice(activeSelection.start, activeSelection.end)
      : "";

  const selectionPreview = selectedText ? truncateSelectionPreview(selectedText) : "";
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
  const formatPreview = rangesToRichText(value, boldRanges, italicRanges, linkRanges);
  const hasFormatting = Boolean(formatPreview);

  const syncRangesToValue = useCallback(() => {
    const sourceText = value;
    const oldText = prevTextRef.current;
    if (oldText === sourceText) return;

    const nextBold = clampRanges(
      sourceText,
      adjustRangesOnTextChange(oldText, sourceText, boldRef.current),
    );
    const nextItalic = clampRanges(
      sourceText,
      adjustRangesOnTextChange(oldText, sourceText, italicRef.current),
    );
    const nextLinks = linkRef.current
      .map((link) => {
        const adjusted = adjustRangesOnTextChange(oldText, sourceText, [[link.start, link.end]]);
        if (!adjusted.length) return null;
        const [start, end] = adjusted[0];
        return { ...link, start, end };
      })
      .filter((link): link is (typeof linkRef.current)[number] => link !== null);

    boldRef.current = nextBold;
    italicRef.current = nextItalic;
    linkRef.current = nextLinks;
    prevTextRef.current = sourceText;
  }, [value]);

  const getRichTextBlocks = useCallback(() => {
    syncRangesToValue();
    return rangesToRichText(value, boldRef.current, italicRef.current, linkRef.current);
  }, [syncRangesToValue, value]);

  const getRichTextBlocksForSubmit = useCallback(() => {
    syncRangesToValue();
    const fromRefs = rangesToRichText(value, boldRef.current, italicRef.current, linkRef.current);
    const fromState = rangesToRichText(value, boldRanges, italicRanges, linkRanges);
    const refLinks = countLinks(fromRefs);
    const stateLinks = countLinks(fromState);
    if (stateLinks > refLinks) return fromState ?? fromRefs;
    if (refLinks > stateLinks) return fromRefs ?? fromState;
    return fromRefs ?? fromState ?? formatPreview;
  }, [boldRanges, formatPreview, italicRanges, linkRanges, syncRangesToValue, value]);

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
    linkUrlInput,
    setLinkUrlInput,
    setLinkModalVisible,
    handleSelectionChange,
    handleTextChange,
    syncLiveSelection,
    flushSelectionUi,
    toggleBold,
    toggleItalic,
    addLink,
    applyLink,
    resetFormatting,
    clearFormatTarget,
  };
};
