import Link from "next/link";
import { AdminRecoveryForm } from "@/app/admin/recover/recovery-form";
import {
  PASSWORD_RECOVERY_REDIRECT,
  safeAdminAuthRedirect,
} from "@/lib/admin/auth-redirect";

export const dynamic = "force-dynamic";

type AdminRecoverPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminRecoverPage({
  searchParams,
}: AdminRecoverPageProps) {
  const params = await searchParams;
  const tokenHash = getFirstParam(params?.token_hash);
  const next = safeAdminAuthRedirect(
    getFirstParam(params?.next) ?? null,
    PASSWORD_RECOVERY_REDIRECT,
  );

  return (
    <main className="page-shell stack admin-shell">
      <div>
        <p className="eyebrow">Admin Review</p>
        <h1>Reset password</h1>
        <p className="muted">
          Confirm this recovery request before choosing a new password.
        </p>
      </div>
      {tokenHash ? (
        <AdminRecoveryForm next={next} tokenHash={tokenHash} />
      ) : (
        <section className="panel stack admin-login-form">
          <p className="form-error">This recovery link is missing its token.</p>
          <Link className="text-link" href="/admin/login">
            Return to sign in
          </Link>
        </section>
      )}
    </main>
  );
}

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
