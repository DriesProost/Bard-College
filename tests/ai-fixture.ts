import type { ElectronApplication } from "@playwright/test";
/** Test-only OS cipher and HTTP fixture. Not included in packaged application files.
 * This exercises real main/preload/SDK/UI wiring; it does NOT validate DPAPI or live OpenAI. */
export async function installAIFixture(
  app: ElectronApplication,
  mode: "success" | "offline" | "unauthorized" | "unavailable" = "success",
) {
  await app.evaluate(({ safeStorage }, mode) => {
    safeStorage.isEncryptionAvailable = () => true;
    safeStorage.getSelectedStorageBackend = () => "gnome_libsecret";
    safeStorage.encryptString = (value) => Buffer.from("test-cipher:" + value);
    safeStorage.decryptString = (value) =>
      value.toString().replace(/^test-cipher:/, "");
    const state = globalThis as typeof globalThis & { __bardCalls: unknown[] };
    state.__bardCalls = [];
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      state.__bardCalls.push(body); // Deliberately excludes request headers and API keys.
      if (mode === "offline") throw TypeError("Offline test transport");
      if (mode === "unauthorized" || mode === "unavailable")
        return new Response(
          JSON.stringify({
            error: {
              message: "Fixture API error",
              type: "invalid_request_error",
              code:
                mode === "unavailable" ? "model_not_found" : "invalid_api_key",
            },
          }),
          {
            status: mode === "unavailable" ? 404 : 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      const feedback = {
        strength: "The teaspoon anchors the scene in a daily habit.",
        reason: "A concrete object lets the reader infer the absence.",
        improvements: [
          "Try reading the final phrase aloud and remove one unnecessary word.",
        ],
        question: "Which detail would this speaker notice first?",
      };
      const guidance = {
        explanation: "A concrete detail lets the reader infer a feeling.",
        notice: "Look at the original example’s specific object.",
        firstStep: "Write the small task in your own words.",
        finishLine: "A short attempt and one choice you noticed are enough.",
      };
      const final = /This is the last review/.test(body.instructions || "");
      const text =
        body.input === "Reply with only OK."
          ? "OK"
          : body.text?.format?.name === "lesson_guidance"
            ? JSON.stringify(guidance)
            : JSON.stringify({
                ...feedback,
                question: final
                  ? "Keep the detail that supports your intention. That is enough for today."
                  : feedback.question,
              });
      return new Response(
        JSON.stringify({
          id: "resp_fixture",
          object: "response",
          created_at: 1,
          status: "completed",
          model: "gpt-6-luna",
          output: [
            {
              id: "msg_fixture",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text, annotations: [] }],
            },
          ],
          usage: { input_tokens: 20, output_tokens: 30, total_tokens: 50 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
  }, mode);
}
