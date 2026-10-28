export type DiffRowKind = "same" | "changed" | "added" | "removed";

export interface DiffRow {
  kind: DiffRowKind;
  beforeLine?: number;
  before?: string;
  afterLine?: number;
  after?: string;
}

type Operation = { kind: "same" | "added" | "removed"; value: string };

function indexedFallback(before: string[], after: string[]): DiffRow[] {
  const rows: DiffRow[] = [];
  const count = Math.max(before.length, after.length);
  for (let index = 0; index < count; index += 1) {
    const left = before[index];
    const right = after[index];
    rows.push({
      kind:
        left === undefined
          ? "added"
          : right === undefined
            ? "removed"
            : left === right
              ? "same"
              : "changed",
      ...(left === undefined ? {} : { beforeLine: index + 1, before: left }),
      ...(right === undefined ? {} : { afterLine: index + 1, after: right }),
    });
  }
  return rows;
}

export function splitCodeDiff(
  beforeText: string,
  afterText: string,
): DiffRow[] {
  const before = beforeText.replace(/\r\n/g, "\n").split("\n");
  const after = afterText.replace(/\r\n/g, "\n").split("\n");
  if (!beforeText) before.splice(0);
  if (!afterText) after.splice(0);
  if (before.length * after.length > 1_000_000)
    return indexedFallback(before, after);

  const table = Array.from(
    { length: before.length + 1 },
    () => new Uint32Array(after.length + 1),
  );
  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      table[left][right] =
        before[left] === after[right]
          ? table[left + 1][right + 1] + 1
          : Math.max(table[left + 1][right], table[left][right + 1]);
    }
  }

  const operations: Operation[] = [];
  let left = 0;
  let right = 0;
  while (left < before.length && right < after.length) {
    if (before[left] === after[right]) {
      operations.push({ kind: "same", value: before[left] });
      left += 1;
      right += 1;
    } else if (table[left + 1][right] >= table[left][right + 1]) {
      operations.push({ kind: "removed", value: before[left] });
      left += 1;
    } else {
      operations.push({ kind: "added", value: after[right] });
      right += 1;
    }
  }
  while (left < before.length)
    operations.push({ kind: "removed", value: before[left++] });
  while (right < after.length)
    operations.push({ kind: "added", value: after[right++] });

  const rows: DiffRow[] = [];
  let beforeLine = 1;
  let afterLine = 1;
  for (let index = 0; index < operations.length;) {
    const operation = operations[index];
    if (operation.kind === "same") {
      rows.push({
        kind: "same",
        beforeLine,
        before: operation.value,
        afterLine,
        after: operation.value,
      });
      beforeLine += 1;
      afterLine += 1;
      index += 1;
      continue;
    }
    const removed: string[] = [];
    const added: string[] = [];
    while (index < operations.length && operations[index].kind !== "same") {
      const item = operations[index++];
      if (item.kind === "removed") removed.push(item.value);
      else added.push(item.value);
    }
    const count = Math.max(removed.length, added.length);
    for (let offset = 0; offset < count; offset += 1) {
      const oldValue = removed[offset];
      const newValue = added[offset];
      rows.push({
        kind:
          oldValue === undefined
            ? "added"
            : newValue === undefined
              ? "removed"
              : "changed",
        ...(oldValue === undefined
          ? {}
          : { beforeLine: beforeLine++, before: oldValue }),
        ...(newValue === undefined
          ? {}
          : { afterLine: afterLine++, after: newValue }),
      });
    }
  }
  return rows;
}
