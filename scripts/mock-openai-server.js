const http = require("http");

const PORT = 4001;

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/v1/models") {
    return sendJson(res, 200, {
      object: "list",
      data: [
        { id: "auto", object: "model", owned_by: "rw-proxy-mock" },
        { id: "gpt-4.1-mini", object: "model", owned_by: "rw-proxy-mock" },
        { id: "claude-sonnet-4", object: "model", owned_by: "rw-proxy-mock" },
        { id: "gemini-2.5-flash", object: "model", owned_by: "rw-proxy-mock" },
      ],
    });
  }

  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    let payload = {};
    try {
      const raw = await collectBody(req);
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, {
        error: {
          message: "Invalid JSON body",
        },
      });
    }

    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const lastUserMessage = [...messages].reverse().find((item) => item && item.role === "user");
    const prompt = typeof lastUserMessage?.content === "string" ? lastUserMessage.content : "";
    const model = typeof payload.model === "string" ? payload.model : "unknown-model";

    return sendJson(res, 200, {
      id: "chatcmpl-rw-proxy-mock",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: `Mock reply from ${model}: ${prompt || "no prompt provided"}`,
          },
        },
      ],
      usage: {
        prompt_tokens: 16,
        completion_tokens: 12,
        total_tokens: 28,
      },
    });
  }

  sendJson(res, 404, {
    error: {
      message: `Route not found: ${req.method} ${req.url}`,
    },
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`rw-proxy mock OpenAI server running at http://127.0.0.1:${PORT}`);
});
