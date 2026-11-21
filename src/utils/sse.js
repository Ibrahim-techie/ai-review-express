// Server-Sent Events over a POST response (read on the client with fetch +
// ReadableStream). Heartbeats keep proxies and load balancers from closing
// the connection while a slow free-tier model is still thinking.
export function openSse(res, { heartbeatMs = 15_000 } = {}) {
  res.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const timer = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, heartbeatMs);

  return {
    send(event, data) {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      clearInterval(timer);
      if (!res.writableEnded) res.end();
    },
  };
}
