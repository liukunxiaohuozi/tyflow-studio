import {
  loadZenTaoCatalog,
  normalizeZenTaoBaseUrl,
} from "../src/main/zentao";

test.each([
  ["https://chandao.tingyun.com/pro/", "https://chandao.tingyun.com/pro/"],
  ["https://chandao.tingyun.com/pro/my/", "https://chandao.tingyun.com/pro/"],
  ["https://chandao.tingyun.com/pro/my.html", "https://chandao.tingyun.com/pro/"],
])("normalizes a ZenTao page URL to its application root", (input, expected) => {
  expect(normalizeZenTaoBaseUrl(input)).toBe(expected);
});

test("authenticates and discovers visible ZenTao products, projects, tasks and bugs", async () => {
  const responses = [
    new Response("<input name='verifyRand' id='verifyRand' value='salt'>", {
      headers: { "set-cookie": "zentaosid=first; Path=/" },
    }),
    new Response(JSON.stringify({ status: "success" }), {
      headers: { "set-cookie": "lang=zh-cn; Path=/" },
    }),
    new Response(
      '<a href="/pro/product-browse-12.html">APM</a><a href="/pro/project-task-34.html">APM 迭代</a>',
    ),
    new Response('<a href="/pro/task-view-81742.html" title="优化查询">81742</a>'),
    new Response('<a href="/pro/bug-view-60515.html">筛选异常</a>'),
    new Response('<a href="product-browse-12.html">查看全部</a>'),
    new Response('<a href="project-task-34.html">查看全部</a>'),
    new Response(JSON.stringify({ status: "success", data: JSON.stringify({ 12: "APM" }) })),
    new Response(JSON.stringify({ status: "success", data: JSON.stringify({ 34: "APM 迭代" }) })),
  ];
  const original = global.fetch;
  global.fetch = jest.fn(async () => responses.shift()!) as typeof fetch;
  try {
    await expect(
      loadZenTaoCatalog("https://zentao.example.test/pro/", "user", "secret"),
    ).resolves.toEqual({
      products: [{ id: "12", name: "APM" }],
      projects: [{ id: "34", name: "APM 迭代" }],
      items: [
        { id: "81742", name: "优化查询", type: "task" },
        { id: "60515", name: "筛选异常", type: "bug" },
      ],
    });
    expect(global.fetch).toHaveBeenCalledTimes(9);
    const businessRequest = (global.fetch as jest.Mock).mock.calls[2];
    expect((businessRequest[1].headers as Record<string, string>).Cookie).toContain(
      "zentaosid=first",
    );
    expect((businessRequest[1].headers as Record<string, string>).Cookie).toContain(
      "lang=zh-cn",
    );
  } finally {
    global.fetch = original;
  }
});

test("rejects an unsuccessful ZenTao login", async () => {
  const responses = [
    new Response("<input name='verifyRand' id='verifyRand' value='salt'>"),
    new Response(JSON.stringify({ status: "fail" })),
  ];
  const original = global.fetch;
  global.fetch = jest.fn(async () => responses.shift()!) as typeof fetch;
  try {
    await expect(
      loadZenTaoCatalog("https://zentao.example.test/pro/", "user", "wrong"),
    ).rejects.toThrow("禅道登录失败");
  } finally {
    global.fetch = original;
  }
});
