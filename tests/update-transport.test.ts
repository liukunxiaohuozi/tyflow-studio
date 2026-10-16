import { EventEmitter } from "node:events";
import type { net } from "electron";
import { createUpdateFetch } from "../src/main/update-transport";

class Client extends EventEmitter {
  abort = jest.fn();
  end = jest.fn();
}
function fixture() {
  const client = new Client();
  const request = jest.fn(() => client) as unknown as jest.MockedFunction<
    typeof net.request
  >;
  return { client, request, fetch: createUpdateFetch(request) };
}
const init = { redirect: "manual", credentials: "omit" } as const;

test("exposes a redirect response without auto-following or exposing cookies", async () => {
  const { client, request, fetch } = fixture();
  const pending = fetch("https://updates.example.invalid/start", {
    ...init,
    headers: { Authorization: "Bearer public-fixture", Cookie: "do-not-send" },
  });
  client.emit("redirect", 302, "GET", "https://cdn.example.invalid/end", {
    "set-cookie": ["do-not-expose"],
    location: ["https://cdn.example.invalid/end"],
  });
  const result = await pending;
  expect(result.status).toBe(302);
  expect(result.headers.get("location")).toBe(
    "https://cdn.example.invalid/end",
  );
  expect(result.headers.has("set-cookie")).toBe(false);
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      redirect: "manual",
      credentials: "omit",
      useSessionCookies: false,
      headers: { authorization: "Bearer public-fixture" },
    }),
  );
  expect(client.abort).toHaveBeenCalledTimes(1);
  client.emit("error", new Error("Redirect was cancelled"));
});

test("streams response chunks and preserves response metadata", async () => {
  const { client, fetch } = fixture();
  const pending = fetch("https://updates.example.invalid/package", init);
  const message = Object.assign(new EventEmitter(), {
    statusCode: 200,
    headers: { "content-type": "application/octet-stream" },
  });
  client.emit("response", message);
  const result = await pending;
  message.emit("data", Buffer.from([1, 2, 3]));
  message.emit("data", Buffer.from([4, 5]));
  message.emit("end");
  expect(Buffer.from(await result.arrayBuffer())).toEqual(
    Buffer.from([1, 2, 3, 4, 5]),
  );
  expect(result.headers.get("content-type")).toBe("application/octet-stream");
  expect(client.abort).not.toHaveBeenCalled();
});

test("pre-aborted requests never start and active response aborts reject their body", async () => {
  const first = fixture(),
    controller = new AbortController();
  controller.abort();
  await expect(
    first.fetch("https://updates.example.invalid", {
      ...init,
      signal: controller.signal,
    }),
  ).rejects.toThrow();
  expect(first.client.end).not.toHaveBeenCalled();
  const second = fixture(),
    active = new AbortController();
  const pending = second.fetch("https://updates.example.invalid", {
    ...init,
    signal: active.signal,
  });
  second.client.emit(
    "response",
    Object.assign(new EventEmitter(), { statusCode: 200, headers: {} }),
  );
  const response = await pending;
  active.abort();
  await expect(response.text()).rejects.toThrow();
  expect(second.client.abort).toHaveBeenCalledTimes(1);
});

test("consumer cancellation stops the network request and interrupted bodies fail", async () => {
  const first = fixture(),
    pending = first.fetch("https://updates.example.invalid", init);
  first.client.emit(
    "response",
    Object.assign(new EventEmitter(), { statusCode: 200, headers: {} }),
  );
  await (await pending).body!.cancel();
  expect(first.client.abort).toHaveBeenCalledTimes(1);
  const second = fixture(),
    pendingSecond = second.fetch("https://updates.example.invalid", init);
  const message = Object.assign(new EventEmitter(), {
    statusCode: 200,
    headers: {},
  });
  second.client.emit("response", message);
  const response = await pendingSecond;
  message.emit("aborted");
  await expect(response.text()).rejects.toThrow("interrupted");
});

test("does not permit callers to opt into automatic redirects or write methods", async () => {
  const { fetch, request } = fixture();
  await expect(
    fetch("https://updates.example.invalid", { redirect: "follow" }),
  ).rejects.toThrow("Unsupported");
  await expect(
    fetch("https://updates.example.invalid", { ...init, method: "POST" }),
  ).rejects.toThrow("Unsupported");
  expect(request).not.toHaveBeenCalled();
});
