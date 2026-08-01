import { AdminLoginForm } from "@/app/admin/login/login-form";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <main className="page-shell stack admin-shell">
      <div>
        <p className="eyebrow">Admin Review</p>
        <h1>Sign in</h1>
        <p className="muted">
          Supabase Auth is required before any admin review data is queried.
        </p>
      </div>
      <AdminLoginForm />
    </main>
  );
}
