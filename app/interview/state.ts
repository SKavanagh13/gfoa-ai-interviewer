import type { memberProfileToFormProfile } from "@/lib/intake/profile";

export type LookupState = {
  email: string;
  errors: string[];
  match:
    | ReturnType<typeof memberProfileToFormProfile>
    | null;
  searched: boolean;
};

export type CreateInterviewState = {
  errors: string[];
};

export const initialLookupState: LookupState = {
  email: "",
  errors: [],
  match: null,
  searched: false,
};

export const initialCreateInterviewState: CreateInterviewState = {
  errors: [],
};
