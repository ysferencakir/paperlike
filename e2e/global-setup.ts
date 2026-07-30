import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.cwd(), "out");
const port = 3100;
const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function candidatePaths(pathname: string): string[] {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  if (extname(cleanPath)) return [cleanPath];
  return [`${cleanPath}.html`, `${cleanPath}/index.html`];
}

async function resolveFile(pathname: string): Promise<string | null> {
  for (const candidate of candidatePaths(pathname)) {
    const absolute = resolve(root, `.${candidate}`);
    if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) continue;
    try {
      if ((await stat(absolute)).isFile()) return absolute;
    } catch {
      // Try the next static-export path shape.
    }
  }
  return null;
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  await access(root);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url ?? "/", "http://localhost").pathname
      );
      const file = await resolveFile(pathname);
      if (!file) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": mimeTypes[extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end("Internal server error");
    }
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });

  return async () => {
    server.closeAllConnections();
    await new Promise<void>((resolveClose, reject) => {
      server.close((error) => (error ? reject(error) : resolveClose()));
    });
  };
}
