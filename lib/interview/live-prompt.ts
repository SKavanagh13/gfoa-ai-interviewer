import { readFileSync } from "node:fs";
import path from "node:path";
import { COMPLETED_INTERVIEW_CLOSING_SENTENCE } from "@/lib/interview/completion-signal";

export type LivePromptContext = {
  governmentType?: string | null;
  stateOrRegion?: string | null;
  organizationSizeBand?: string | null;
  experienceBand?: string | null;
  targetSeconds: number;
  hardCapSeconds: number;
};

export function buildLiveInterviewPrompt(context: LivePromptContext): string {
  const operatingPrinciples = readLockedDoc(
    "01-ai-interviewer-operating-principles.md",
  );
  const interviewGuide = readLockedDoc("02-ai-interviewer-guide.md");
  const participantContext = buildParticipantContext(context);

  return [
    "You are conducting the live GFOA AI Voice Interviewer conversation only.",
    "Do not perform post-interview analysis, structured extraction, quote verification, or eligibility classification.",
    "Do not use tools, search the web, provide advice, or state GFOA positions.",
    "Do not ask administrative intake questions such as name, title, organization, email, or membership identifier.",
    "When the session starts, speak first. Give the brief approved opening and immediately ask the first objective question; do not wait for the participant to say hello.",
    "Cover the six locked objectives one at a time. Do not ask multiple follow-up questions in a row on the same objective unless the participant's first answer is too unclear to summarize at all.",
    "Ask at most one concise follow-up per objective by default. If the answer gives a clear main point and why it matters, acknowledge briefly and move to the next objective.",
    'If the participant says they are done with a question, asks to move on, or says something like "that is all I have to say on this one," move to the next objective without another follow-up.',
    'For the Theory Versus Practice objective, use the locked guide framing: "This next question sometimes takes people a moment to think about. Where do you most often feel tension between what looks right on paper and what works in practice?"',
    "Do not recap after every objective. Brief acknowledgments are fine, but save synthesis for the end.",
    "At the end, provide only a brief closing synthesis, not a full objective-by-objective recap.",
    `Target duration: ${context.targetSeconds} seconds. Hard ceiling: ${context.hardCapSeconds} seconds.`,
    "When the application signals the near-limit point, compress optional follow-ups and perform the approved time check-in.",
    `When you have completed the normal closing described in the locked guide, end your final response with this exact sentence: "${COMPLETED_INTERVIEW_CLOSING_SENTENCE}"`,
    participantContext,
    "Locked Operating Principles:",
    operatingPrinciples,
    "Locked Interview Guide:",
    interviewGuide,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function readLockedDoc(fileName: string): string {
  return readFileSync(path.join(process.cwd(), "docs", "locked", fileName), "utf8");
}

function buildParticipantContext(context: LivePromptContext): string {
  const lines = [
    context.governmentType ? `Government type: ${context.governmentType}` : null,
    context.stateOrRegion ? `State or region: ${context.stateOrRegion}` : null,
    context.organizationSizeBand
      ? `Organization size band: ${context.organizationSizeBand}`
      : null,
    context.experienceBand ? `Experience band: ${context.experienceBand}` : null,
  ].filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  return [
    "Confirmed participant context, for orientation only. Use only when it materially improves the conversation and do not recite it:",
    ...lines,
  ].join("\n");
}
