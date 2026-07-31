import { IntakeFlow } from "@/app/interview/intake-flow";

export default function InterviewPage() {
  return (
    <main className="page-shell stack">
      <div>
        <p className="eyebrow">Wave 2 intake and consent</p>
        <h1>GFOA AI Voice Interviewer</h1>
        <p className="muted">
          Confirm your profile and consent before the voice interview begins.
          Audio capture and the live interview session are reserved for the next
          implementation wave.
        </p>
      </div>
      <IntakeFlow />
    </main>
  );
}
