import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell stack">
      <div>
        <p className="eyebrow">GFOA</p>
        <h1>GFOA AI Voice Interviewer</h1>
        <p className="muted">
          A guided voice interview for understanding public finance
          professionals&apos; experiences and perspectives.
        </p>
      </div>
      <nav aria-label="Project routes" className="panel">
        <ul className="nav-list">
          <li>
            <Link href="/interview">Start interview</Link>
          </li>
          <li>
            <Link href="/admin">Admin review</Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}
