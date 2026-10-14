import net from "node:net";

export async function availablePort(preferred: number) {
  const probe = (port: number) =>
    new Promise<number>((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        const address = server.address();
        const result =
          typeof address === "object" && address ? address.port : 0;
        server.close(() => resolve(result));
      });
    });
  try {
    return await probe(preferred);
  } catch {
    return probe(0);
  }
}
