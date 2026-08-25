import Link from "next/link";
import { redirect } from "next/navigation";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const code = getFirstParam(params?.code);
  const tokenHash = getFirstParam(params?.token_hash);
  const type = getFirstParam(params?.type);

  if (code) {
    redirect(withAuthParams("/auth/callback", params));
  }

  if (tokenHash && type) {
    redirect(withAuthParams("/auth/confirm", params));
  }

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

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function withAuthParams(
  pathname: "/auth/callback" | "/auth/confirm",
  params: Record<string, string | string[] | undefined> | undefined,
) {
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    const firstValue = getFirstParam(value);

    if (firstValue) {
      nextParams.set(key, firstValue);
    }
  }

  return `${pathname}?${nextParams.toString()}`;
}
