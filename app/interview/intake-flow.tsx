"use client";

import { useActionState } from "react";
import { createInterview, lookupMember } from "@/app/interview/actions";
import {
  initialCreateInterviewState,
  initialLookupState,
} from "@/app/interview/state";
import { consentDisclosureItems, CONSENT_VERSION } from "@/lib/intake/consent";

export function IntakeFlow() {
  const [lookupState, lookupAction, lookupPending] = useActionState(
    lookupMember,
    initialLookupState,
  );
  const [createState, createAction, createPending] = useActionState(
    createInterview,
    initialCreateInterviewState,
  );
  const source = lookupState.match ? "matched" : "unmatched";

  return (
    <div className="intake-grid">
      <section className="panel stack" aria-labelledby="lookup-heading">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2 id="lookup-heading">Find Your Profile</h2>
        </div>
        <form action={lookupAction} className="form-stack">
          <label className="field">
            <span>Email address</span>
            <input
              name="email"
              type="email"
              required
              placeholder="you@example.org"
              defaultValue={lookupState.email}
            />
          </label>
          <ErrorList errors={lookupState.errors} />
          <button type="submit" disabled={lookupPending}>
            {lookupPending ? "Checking..." : "Look up profile"}
          </button>
        </form>
      </section>

      <section className="panel stack" aria-labelledby="consent-heading">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2 id="consent-heading">Confirm and Consent</h2>
        </div>
        <form
          action={createAction}
          className="form-stack"
          key={`${source}-${lookupState.match?.gfoaMemberId ?? lookupState.email}`}
        >
          <input type="hidden" name="source" value={source} />
          <input
            type="hidden"
            name="gfoaMemberId"
            value={lookupState.match?.gfoaMemberId ?? ""}
          />

          {lookupState.searched && lookupState.match ? (
            <p className="status-note">Profile match found. Confirm or correct it below.</p>
          ) : null}
          {lookupState.searched && !lookupState.match ? (
            <p className="status-note">
              No member profile was found. Provide the minimum profile details
              below.
            </p>
          ) : null}

          <div className="field-grid">
            <label className="field">
              <span>Email address</span>
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.org"
                defaultValue={lookupState.match?.email ?? lookupState.email}
              />
            </label>
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                defaultValue={lookupState.match?.name ?? ""}
                disabled={!lookupState.match}
              />
            </label>
            <label className="field">
              <span>Title or role</span>
              <input name="title" required defaultValue={lookupState.match?.title ?? ""} />
            </label>
            <label className="field">
              <span>Organization</span>
              <input
                name="organizationName"
                defaultValue={lookupState.match?.organizationName ?? ""}
                disabled={!lookupState.match}
              />
            </label>
            <label className="field">
              <span>Government type</span>
              <input
                name="governmentType"
                required
                defaultValue={lookupState.match?.governmentType ?? ""}
              />
            </label>
            <label className="field">
              <span>State or region</span>
              <input
                name="stateOrRegion"
                required
                defaultValue={lookupState.match?.stateOrRegion ?? ""}
              />
            </label>
            <label className="field">
              <span>Organization size band</span>
              <input
                name="organizationSizeBand"
                defaultValue={lookupState.match?.organizationSizeBand ?? ""}
              />
            </label>
            <label className="field">
              <span>Experience band</span>
              <input
                name="experienceBand"
                defaultValue={lookupState.match?.experienceBand ?? ""}
              />
            </label>
          </div>

          {lookupState.match ? (
            <label className="checkbox-row">
              <input name="matchedProfileWasCorrected" type="checkbox" />
              <span>I corrected one or more matched profile fields.</span>
            </label>
          ) : null}

          <div className="notice-list" aria-label="Required disclosure">
            {consentDisclosureItems.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>

          <label className="checkbox-row">
            <input name="consent" type="checkbox" required />
            <span>
              I consent to this AI interview, recording, and transcription under{" "}
              {CONSENT_VERSION}.
            </span>
          </label>
          <ErrorList errors={createState.errors} />
          <button type="submit" disabled={createPending}>
            {createPending ? "Creating..." : "Create interview record"}
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
