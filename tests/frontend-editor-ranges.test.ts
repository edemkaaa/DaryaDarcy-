import { describe, expect, it } from "vitest";
import { adjustEditorRanges } from "../apps/frontend/src/features/admin/editor-range-change";

describe("native editor range changes", () => {
  it("deletes the selected linked occurrence instead of attaching it to an identical word", () => {
    expect(
      adjustEditorRanges("Ссылка Ссылка", "Ссылка", [[0, 6]], {
        start: 0,
        end: 7,
        inputType: "deleteContentBackward",
      }),
    ).toEqual([]);
  });
  it("keeps the surviving linked occurrence when an identical unlinked prefix is deleted", () => {
    expect(
      adjustEditorRanges("Ссылка Ссылка", "Ссылка", [[7, 13]], {
        start: 0,
        end: 7,
        inputType: "deleteByCut",
      }),
    ).toEqual([[0, 6]]);
  });
  it.each(["deleteContentBackward", "deleteContentForward"])(
    "handles %s among repeated characters at the actual caret",
    (inputType) => {
      const position = inputType.endsWith("Backward") ? 2 : 1;
      expect(
        adjustEditorRanges(
          "aaaa",
          "aaa",
          [
            [1, 2],
            [3, 4],
          ],
          {
            start: position,
            end: position,
            inputType,
          },
        ),
      ).toEqual([[2, 3]]);
    },
  );
  it("keeps a link on the remaining text after partial deletion", () => {
    expect(
      adjustEditorRanges("Ссылка", "Ссылк", [[0, 6]], {
        start: 6,
        end: 6,
        inputType: "deleteContentBackward",
      }),
    ).toEqual([[0, 5]]);
  });
  it("accounts for UTF-16 emoji deletion", () => {
    expect(
      adjustEditorRanges(
        "😀😀",
        "😀",
        [
          [0, 2],
          [2, 4],
        ],
        {
          start: 2,
          end: 2,
          inputType: "deleteContentBackward",
        },
      ),
    ).toEqual([[0, 2]]);
  });
  it("does not move a removed link to another identical fragment without a native hint", () => {
    expect(
      adjustEditorRanges("Ссылка и Ссылка", " и Ссылка", [[0, 6]]),
    ).toEqual([]);
  });
  it("removes formatting when its entire text is replaced", () => {
    expect(
      adjustEditorRanges("Ссылка", "Другой текст", [[0, 6]], {
        start: 0,
        end: 6,
        inputType: "insertFromPaste",
      }),
    ).toEqual([]);
  });
  it("keeps unrelated links when text is inserted before them", () => {
    expect(
      adjustEditorRanges("Ссылка", "Новый Ссылка", [[0, 6]], {
        start: 0,
        end: 0,
        inputType: "insertText",
      }),
    ).toEqual([[6, 12]]);
  });
  it("validates a stale edit hint against the actual text change", () => {
    expect(
      adjustEditorRanges("abc def", "abc Xdef", [[4, 7]], {
        start: 0,
        end: 3,
        inputType: "deleteByCut",
      }),
    ).toEqual([[5, 8]]);
  });
});
