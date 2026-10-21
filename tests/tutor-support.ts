import type { Store } from "../electron/store.js";
/** Store tests emulate an already successful provider review. Network wiring is tested separately. */
export const guidanceFixture = {
  explanation: "Notice the concrete choice.",
  notice: "Compare one detail.",
  firstStep: "Make the installed minimum task.",
  finishLine: "One short attempt and an observation.",
};
export const feedbackFixture = {
  strength: "A concrete choice.",
  reason: "It supports the intention.",
  improvements: ["Compare one alternative."],
  question: "Which choice serves your intention?",
};
export function saveReviewedAttempt(
  store: Store,
  a: Parameters<Store["saveAttempt"]>[0],
) {
  if (a.complete) {
    const session = store.startTutorSession(
      a.lessonId,
      guidanceFixture,
      a.practicePrompt || "",
    );
    store.appendTutorTurn(
      a.lessonId,
      session.id,
      a.revision || a.body,
      feedbackFixture,
      a.practicePrompt || "",
    );
  }
  return store.saveAttempt(a);
}
