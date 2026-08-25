import { IntakeFlow } from "@/app/interview/intake-flow";
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
    <main className="listening-page-shell">
      <IntakeFlow />
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
