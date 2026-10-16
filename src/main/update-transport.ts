import type { net } from "electron";

/** Updater-only GET transport. Electron net.fetch rejects manual redirects rather
 * than returning their status/Location; net.request exposes the redirect event.
 * UpdateManager remains responsible for HTTPS, hop limits and per-origin tokens.
 */
export function createUpdateFetch(request: typeof net.request): typeof fetch {
  return async (input, init = {}) => {
    if (
      (
        init.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase() !== "GET" ||
      init.body ||
      init.redirect !== "manual"
    )
      throw new Error("Unsupported update transport request");
    const url = input instanceof Request ? input.url : String(input);
    const headers = new Headers(init.headers);
    headers.delete("Cookie");
    headers.delete("Proxy-Authorization");
    return new Promise<Response>((resolve, reject) => {
      const client = request({
        url,
        method: "GET",
        headers: Object.fromEntries(headers),
        redirect: "manual",
        credentials: "omit",
        useSessionCookies: false,
      });
      let settled = false,
        complete = false;
      let body: ReadableStreamDefaultController<Uint8Array> | undefined;
      const cleanup = () => init.signal?.removeEventListener("abort", abort);
      const fail = (reason: unknown) => {
        if (complete) return;
        complete = true;
        cleanup();
        if (!settled) {
          settled = true;
          reject(reason);
        } else body?.error(reason);
        client.abort();
      };
      const abort = () =>
        fail(
          init.signal?.reason ??
            new DOMException("Update request aborted", "AbortError"),
        );
      client.on("error", fail);
      client.on("redirect", (status, _method, location, values) => {
        if (complete) return;
        const responseHeaders = new Headers();
        for (const [name, list] of Object.entries(values))
          for (const value of list)
            if (name.toLowerCase() !== "set-cookie")
              responseHeaders.append(name, value);
        responseHeaders.set("Location", location);
        complete = true;
        settled = true;
        cleanup();
        resolve(new Response(null, { status, headers: responseHeaders }));
        client.abort();
      });
      client.on("response", (incoming) => {
        if (complete) return;
        const responseHeaders = new Headers();
        for (const [name, values] of Object.entries(incoming.headers))
          for (const value of Array.isArray(values) ? values : [values])
            if (name.toLowerCase() !== "set-cookie")
              responseHeaders.append(name, value);
        const empty = [204, 205, 304].includes(incoming.statusCode);
        const stream = empty
          ? null
          : new ReadableStream<Uint8Array>(
              {
                start(controller) {
                  body = controller;
                },
                cancel() {
                  complete = true;
                  cleanup();
                  client.abort();
                },
              },
              new ByteLengthQueuingStrategy({ highWaterMark: 256 * 1024 }),
            );
        incoming.on("error", fail);
        incoming.on("aborted", () =>
          fail(new Error("Update response was interrupted")),
        );
        incoming.on("end", () => {
          if (!complete) {
            complete = true;
            cleanup();
            body?.close();
          }
        });
        incoming.on("data", (chunk) => {
          if (complete || !body) return;
          // IncomingMessage has no documented pause/resume API. Bound its bridge
          // queue so a stalled disk/consumer cannot accumulate a whole package.
          if ((body.desiredSize ?? 0) < -64 * 1024 * 1024) {
            fail(new Error("更新下载缓冲超限，请检查磁盘空间与写入速度后重试"));
            return;
          }
          body.enqueue(chunk);
        });
        settled = true;
        resolve(
          new Response(stream, {
            status: incoming.statusCode,
            headers: responseHeaders,
          }),
        );
        if (empty) {
          complete = true;
          cleanup();
          client.abort();
        }
      });
      init.signal?.addEventListener("abort", abort, { once: true });
      if (init.signal?.aborted) abort();
      else client.end();
    });
  };
}
