import type { Database } from "@/types/database.types";

export type TranscriptSpeaker = Database["public"]["Enums"]["transcript_speaker"];

export type CanonicalTranscriptSegment = {
  segmentId: string;
  interviewId: string;
  sequenceNumber: number;
  speaker: TranscriptSpeaker;
  text: string;
  startTimeMs: number | null;
  endTimeMs: number | null;
  providerEventId: string | null;
  isFinal: boolean;
};
