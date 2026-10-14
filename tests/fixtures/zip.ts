/** Stored ZIP fixture; validates via independent OS extraction in updater tests. */
export function zipFixture(
  entries: { name: string; body: string; mode?: number }[],
) {
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name),
      body = Buffer.from(entry.body);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let i = 0; i < 8; i++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(body.length, 22);
    header.writeUInt16LE(name.length, 26);
    const item = Buffer.alloc(46);
    item.writeUInt32LE(0x02014b50);
    item.writeUInt16LE(0x0314, 4);
    item.writeUInt16LE(20, 6);
    item.writeUInt32LE(crc, 16);
    item.writeUInt32LE(body.length, 20);
    item.writeUInt32LE(body.length, 24);
    item.writeUInt16LE(name.length, 28);
    item.writeUInt32LE(((entry.mode ?? 0o100644) << 16) >>> 0, 38);
    item.writeUInt32LE(offset, 42);
    local.push(header, name, body);
    central.push(item, name);
    offset += header.length + name.length + body.length;
  }
  const table = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(table.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, table, end]);
}
