"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { createInterview } from "@/app/interview/actions";
import { initialCreateInterviewState } from "@/app/interview/state";
import { consentDisclosureItems } from "@/lib/intake/consent";

type IntakeStep = "landing" | "intake" | "consent";

const isLocalPreview = process.env.NODE_ENV !== "production";

export function IntakeFlow() {
  const [createState, createAction, createPending] = useActionState(
    createInterview,
    initialCreateInterviewState,
  );
  const [step, setStep] = useState<IntakeStep>("landing");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [consented, setConsented] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedConfirmEmail = confirmEmail.trim().toLowerCase();
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const emailsMatch =
    normalizedEmail.length > 0 && normalizedEmail === normalizedConfirmEmail;
  const showMismatch =
    normalizedConfirmEmail.length > 0 &&
    normalizedEmail !== normalizedConfirmEmail;
  const canContinueToConsent = emailLooksValid && emailsMatch;

  const intakeStatus = useMemo(() => {
    if (createPending) {
      return "loading";
    }

    if (canContinueToConsent) {
      return "valid";
    }

    if (showMismatch) {
      return "error";
    }

    return "default";
  }, [canContinueToConsent, createPending, showMismatch]);

  if (step === "landing") {
    return (
      <section className="lp-card lp-card-landing" aria-labelledby="landing-title">
        <div className="lp-landing-copy">
          <GfoaMark />
          <h1 id="landing-title">The Listening Post</h1>
          <p>
            A short voice conversation about what public finance professionals
            are seeing, balancing, and needing in their work.
          </p>
          <button
            className="lp-button lp-button-primary"
            type="button"
            onClick={() => setStep("intake")}
          >
            Begin the interview
          </button>
          <p className="lp-footnote">
            It takes about 15 minutes. Recording starts only after you consent.
          </p>
        </div>
        <div className="lp-landing-visual" aria-hidden="true">
          <SignalTower animated />
        </div>
      </section>
    );
  }

  if (step === "intake") {
    return (
      <section className="lp-card lp-card-narrow" aria-labelledby="intake-title">
        <div className="lp-screen-header">
          <div>
            <p className="lp-eyebrow">Step 1 of 2</p>
            <h1 id="intake-title">Confirm your email</h1>
            <p className="lp-muted">
              We use your email to create the interview record and, when
              available, link existing GFOA profile context without asking you
              to re-enter it.
            </p>
          </div>
          <div className="lp-mini-signal" aria-hidden="true">
            <SignalTower animated />
          </div>
        </div>

        <div className="lp-form-stack">
          <EmailField
            label="Email address"
            name="email"
            value={email}
            status={intakeStatus}
            disabled={createPending}
            onChange={setEmail}
          />
          <EmailField
            label="Confirm email address"
            name="confirmEmail"
            value={confirmEmail}
            status={intakeStatus}
            disabled={createPending}
            onChange={setConfirmEmail}
          />
          {showMismatch ? (
            <p className="lp-field-error" role="alert">
              Email addresses must match.
            </p>
          ) : null}
          <ErrorList errors={createState.errors} />
          <button
            className="lp-button lp-button-primary"
            type="button"
            disabled={!canContinueToConsent || createPending}
            onClick={() => setStep("consent")}
          >
            Continue
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="lp-card lp-card-narrow" aria-labelledby="consent-heading">
      <div className="lp-screen-header">
        <div>
          <p className="lp-eyebrow">Step 2 of 2</p>
          <h1 id="consent-heading">Consent to continue</h1>
          <p className="lp-muted">
            Please review what will happen before the interview begins.
          </p>
        </div>
        <div className="lp-mini-signal" aria-hidden="true">
          <SignalTower animated />
        </div>
      </div>

      <form action={createAction} className="lp-form-stack">
        <input name="email" type="hidden" value={normalizedEmail} />
        <input name="confirmEmail" type="hidden" value={normalizedConfirmEmail} />

        <div className="lp-disclosure-panel" aria-label="Required disclosure">
          {consentDisclosureItems.map((item) => (
            <p key={item}>
              <span aria-hidden="true">{"\u2713"}</span>
              {item}
            </p>
          ))}
        </div>

        <div className="lp-talk-note">
          <h2>What to expect</h2>
          <p>
            This is intended to feel like a conversational interview, not a
            mechanical survey. The interviewer will ask questions and may ask
            follow-ups depending on your answers. It will move through its list,
            tell you when the questions are complete, thank you, and then ask
            you to end the interview. It may wait a second or two after you
            finish speaking so it does not cut you off.
          </p>
        </div>

        <label className="lp-checkbox-row">
          <input
            name="consent"
            type="checkbox"
            required
            checked={consented}
            onChange={(event) => setConsented(event.currentTarget.checked)}
          />
          <span>
            I consent to this AI interview, recording, and transcription.
          </span>
        </label>
        <ErrorList errors={createState.errors} />
        <div className="lp-button-row">
          <button
            className="lp-button lp-button-secondary"
            type="button"
            disabled={createPending}
            onClick={() => setStep("intake")}
          >
            Back
          </button>
          <button
            className="lp-button lp-button-primary"
            type="submit"
            disabled={!consented || createPending}
          >
            {createPending ? (
              <>
                <span className="lp-spinner" aria-hidden="true" />
                Setting up...
              </>
            ) : (
              "Continue to setup"
            )}
          </button>
          {isLocalPreview ? (
            <button
              className="lp-button lp-button-secondary"
              type="button"
              disabled={!consented || createPending}
              onClick={() => {
                window.location.href =
                  "/interview/created?interviewId=preview&preview=1";
              }}
            >
              Preview without saving
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function ErrorList({ errors = [] }: { errors?: string[] }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <ul className="lp-error-list" role="alert">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

function EmailField({
  label,
  name,
  value,
  status,
  disabled,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  status: "default" | "valid" | "error" | "loading";
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const isValid = status === "valid";
  const isError = status === "error";

  return (
    <label className="lp-field">
      <span>{label}</span>
      <span className="lp-input-wrap">
        <input
          name={name}
          type="email"
          value={value}
          disabled={disabled}
          placeholder="you@example.org"
          aria-invalid={isError}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        {isValid ? (
          <span className="lp-input-check" aria-hidden="true">
            {"\u2713"}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function GfoaMark() {
  return (
    <div className="lp-mark" aria-label="GFOA">
      <span>GFOA</span>
    </div>
  );
}

function SignalTower({ animated = false }: { animated?: boolean }) {
  return (
    <span className={animated ? "lp-tower lp-tower-animated" : "lp-tower"}>
      {animated ? (
        <>
          <span className="lp-ring lp-ring-one" />
          <span className="lp-ring lp-ring-two" />
        </>
      ) : null}
      <span className="lp-tower-dot" />
      <span className="lp-tower-mast" />
      <span className="lp-tower-base" />
    </span>
  );
}
