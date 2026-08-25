import { requireStaffOrAdmin } from "@/lib/admin/auth";
import { AdminPasswordForm } from "@/app/admin/update-password/password-form";

export const dynamic = "force-dynamic";

export default async function AdminUpdatePasswordPage() {
  await requireStaffOrAdmin();

  return (
    <main className="page-shell stack admin-shell">
      <div>
        <p className="eyebrow">Admin Review</p>
        <h1>Update password</h1>
        <p className="muted">
          Choose a new password for your authenticated staff or admin account.
        </p>
      </div>
      <AdminPasswordForm />
    </main>
  );
}
