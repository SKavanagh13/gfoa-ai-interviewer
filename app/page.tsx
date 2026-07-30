import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell stack">
      <div>
        <p className="eyebrow">Wave 0 foundation</p>
        <h1>GFOA AI Voice Interviewer</h1>
        <p className="muted">
          Repository skeleton for the MVP. Participant intake, consent,
          realtime interviewing, analysis, and admin review are reserved for
          later implementation waves.
        </p>
      </div>
      <nav aria-label="Project placeholder routes" className="panel">
        <ul className="nav-list">
          <li>
            <Link href="/interview">Interview placeholder</Link>
          </li>
          <li>
            <Link href="/admin">Admin placeholder</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
