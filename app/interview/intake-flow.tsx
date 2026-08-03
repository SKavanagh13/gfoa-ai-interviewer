"use client";

import { useActionState } from "react";
import { createInterview } from "@/app/interview/actions";
import { initialCreateInterviewState } from "@/app/interview/state";
import { consentDisclosureItems } from "@/lib/intake/consent";

export function IntakeFlow() {
  const [createState, createAction, createPending] = useActionState(
    createInterview,
    initialCreateInterviewState,
  );

  return (
    <div className="single-panel-grid">
      <section className="panel stack" aria-labelledby="consent-heading">
        <div>
          <p className="eyebrow">Ready</p>
          <h2 id="consent-heading">Confirm and Consent</h2>
        </div>
        <form action={createAction} className="form-stack">
          <label className="field">
            <span>Email address</span>
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.org"
            />
          </label>
          <label className="field">
            <span>Confirm email address</span>
            <input
              name="confirmEmail"
              type="email"
              required
              placeholder="you@example.org"
            />
          </label>

          <div className="notice-list" aria-label="Required disclosure">
            {consentDisclosureItems.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>

          <label className="checkbox-row">
            <input name="consent" type="checkbox" required />
            <span>I consent to this AI interview, recording, and transcription</span>
          </label>
          <ErrorList errors={createState.errors} />
          <button type="submit" disabled={createPending}>
            {createPending ? "Setting up..." : "Set up interview"}
          </button>
        </form>
      </section>
    </div>
  );
}

function ErrorList({ errors = [] }: { errors?: string[] }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <ul className="error-list">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}
