/**
 * Canonical Weekly sharing hierarchy labels.
 * Keep CTAs consistent so tests and UI share one vocabulary.
 */

export const SHARE_WEEKLY_RECAP_LABEL = "Share weekly recap";
export const SHARE_THIS_CARD_LABEL = "Share this card";
export const SAVE_IMAGE_LABEL = "Save image";
export const EMAIL_TOOLS_LABEL = "Email tools";
export const VIEW_EMAIL_LABEL = "View email";
export const COPY_PUBLIC_RECAP_LINK_LABEL = "Copy public recap link";
export const SEND_EMAIL_LABEL = "Send email";

/** Labels that must not appear as competing week-level primary CTAs. */
export const DEMOLISHED_WEEK_LEVEL_SHARE_LABELS = [
  "Share Week",
  "More share options",
  "Post the Roast",
  "Preview & Send",
  "Preview email",
  "Copy recap link",
] as const;
