/** Lets any button open the Feedback panel (the tab on the page edge), optionally with a kind and a starting text. */
export const FEEDBACK_OPEN_EVENT = "os:open-feedback";

export type FeedbackOpenDetail = {
  category?: "wrong" | "correction" | "idea" | "impression";
  text?: string;
};

export function openFeedback(detail: FeedbackOpenDetail = {}) {
  window.dispatchEvent(new CustomEvent<FeedbackOpenDetail>(FEEDBACK_OPEN_EVENT, { detail }));
}
