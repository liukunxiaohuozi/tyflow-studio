import { splitCodeDiff } from "../src/renderer/code-diff";

describe("splitCodeDiff", () => {
  test("aligns unchanged lines around a replacement", () => {
    expect(splitCodeDiff("one\ntwo\nthree", "one\nsecond\nthree")).toEqual([
      {
        kind: "same",
        beforeLine: 1,
        before: "one",
        afterLine: 1,
        after: "one",
      },
      {
        kind: "changed",
        beforeLine: 2,
        before: "two",
        afterLine: 2,
        after: "second",
      },
      {
        kind: "same",
        beforeLine: 3,
        before: "three",
        afterLine: 3,
        after: "three",
      },
    ]);
  });

  test("keeps line numbers for inserted and removed lines", () => {
    const rows = splitCodeDiff("a\nb\nc", "a\nx\nb");
    expect(rows).toContainEqual({
      kind: "added",
      afterLine: 2,
      after: "x",
    });
    expect(rows).toContainEqual({
      kind: "removed",
      beforeLine: 3,
      before: "c",
    });
  });
});
