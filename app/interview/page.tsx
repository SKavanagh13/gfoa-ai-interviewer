import { IntakeFlow } from "@/app/interview/intake-flow";

export default function InterviewPage() {
  return (
    <main className="page-shell stack">
      <div>
        <p className="eyebrow">Wave 2 intake and consent</p>
        <h1>GFOA AI Voice Interviewer</h1>
        <p className="muted">
          Enter and confirm your email, consent to the interview, and begin the
          live voice session when you are ready.
        </p>
      </div>
      <IntakeFlow />
    </main>
  );
}
