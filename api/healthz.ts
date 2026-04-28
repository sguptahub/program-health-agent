import type { IncomingMessage, ServerResponse } from "http";

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ status: "ok", phase: 1 }));
}
