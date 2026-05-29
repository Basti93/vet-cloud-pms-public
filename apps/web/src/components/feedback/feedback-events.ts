"use client";

export const OPEN_FEEDBACK_EVENT = "vet-cloud:open-feedback";

export type OpenFeedbackDetail = {
  sourceModule?: string;
  sourcePath?: string;
};

export function openFeedbackDialog(detail: OpenFeedbackDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenFeedbackDetail>(OPEN_FEEDBACK_EVENT, { detail }));
}
