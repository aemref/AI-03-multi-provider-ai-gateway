import {
  Gateway,
  ScriptedMockAdapter,
  ToolRegistry,
} from "../dist/src/index.js";

const retrievedDocuments = [
  {
    id: "lesson-tr-001",
    text: "İstanbul is in the Europe/Istanbul time zone.",
  },
];

const adapter = new ScriptedMockAdapter("local-rag-mock", [
  (request) => ({
    id: "response-001",
    model: request.model,
    message: {
      role: "assistant",
      content: "İstanbul uses Europe/Istanbul time [lesson-tr-001].",
    },
    finishReason: "stop",
    usage: { inputTokens: request.messages.length, outputTokens: 8 },
  }),
]);

const gateway = new Gateway([adapter], {
  createRequestId: () => "rag-request-001",
  maxAttemptsPerProvider: 1,
});

const evidence = retrievedDocuments
  .map((document) => `<document id="${document.id}">${document.text}</document>`)
  .join("\n");
const response = await gateway.generate({
  model: "mock-small",
  messages: [
    {
      role: "system",
      content: `Use only the delimited evidence and cite its document id.\n${evidence}`,
    },
    { role: "user", content: "Which time zone does İstanbul use?" },
  ],
  metadata: { workflow: "rag-example" },
});

const tools = new ToolRegistry([
  {
    name: "fetch_lesson",
    description: "Fetch one lesson after host authorization.",
    inputSchema: {
      type: "object",
      required: ["lessonId"],
      additionalProperties: false,
      properties: {
        lessonId: { type: "string", minLength: 1, maxLength: 64 },
      },
    },
  },
]);
const validatedToolCall = tools.validate({
  id: "tool-call-001",
  name: "fetch_lesson",
  argumentsJson: JSON.stringify({ lessonId: "lesson-42" }),
});

console.log(
  JSON.stringify(
    {
      requestId: response.requestId,
      provider: response.provider,
      citationIds: retrievedDocuments.map((document) => document.id),
      answer: response.message.content,
      validatedToolCall,
      toolExecuted: false,
    },
    null,
    2,
  ),
);
