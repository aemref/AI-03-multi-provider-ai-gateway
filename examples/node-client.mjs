const baseUrl = process.env.GATEWAY_BASE_URL ?? "http://localhost:3000";
const request = {
  model: "mock-small",
  messages: [{ role: "user", content: "hello" }],
};

const response = await fetch(`${baseUrl}/v1/stream`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(request),
});

if (!response.ok || response.body === null) {
  throw new Error(`Gateway failed with HTTP ${response.status}`);
}

const decoder = new TextDecoder();
let buffer = "";
for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true }).replaceAll("\r\n", "\n");
  let boundary = buffer.indexOf("\n\n");
  while (boundary >= 0) {
    const frame = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary + 2);
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6))
      .join("\n");
    if (data.length > 0) {
      const event = JSON.parse(data);
      if (event.type === "delta") process.stdout.write(event.content);
      if (event.type === "done") process.stdout.write("\n");
    }
    boundary = buffer.indexOf("\n\n");
  }
}
