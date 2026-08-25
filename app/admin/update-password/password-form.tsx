"use client";

import { useActionState } from "react";
import { updateAdminPassword } from "@/app/admin/update-password/actions";
import { initialAdminPasswordState } from "@/app/admin/update-password/state";

export function AdminPasswordForm() {
  const [state, formAction, pending] = useActionState(
    updateAdminPassword,
    initialAdminPasswordState,
  );

  return (
    <form action={formAction} className="form-stack panel admin-login-form">
      <label className="field">
        <span>New password</span>
        <input
          autoComplete="new-password"
          minLength={8}
          name="password"
          type="password"
        />
      </label>
      <label className="field">
        <span>Confirm new password</span>
        <input
          autoComplete="new-password"
          minLength={8}
          name="confirmPassword"
          type="password"
        />
      </label>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button disabled={pending} type="submit">
        Update Password
      </button>
    </form>
  );
}
