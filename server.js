const http = require("http");

const PORT = process.env.PORT || 3000;

const routes = {
  "/api/hello": (_req) => ({
    message: "Hello, world!",
    timestamp: new Date().toISOString(),
  }),
  "/api/time": (_req) => ({
    utc: new Date().toUTCString(),
    unix: Date.now(),
  }),
};

const server = http.createServer((req, res) => {
  const handler = routes[req.url];

  if (handler) {
    const body = JSON.stringify(handler(req));
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(body);
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
  console.log(`  GET /api/hello`);
  console.log(`  GET /api/time`);
});
