"use client";

import { useActionState } from "react";
import {
  initialAdminLoginState,
  signInAdmin,
} from "@/app/admin/login/actions";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(
    signInAdmin,
    initialAdminLoginState,
  );

  return (
    <form action={formAction} className="form-stack panel admin-login-form">
      <label className="field">
        <span>Email</span>
        <input autoComplete="email" name="email" type="email" />
      </label>
      <label className="field">
        <span>Password</span>
        <input autoComplete="current-password" name="password" type="password" />
      </label>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button disabled={pending} type="submit">
        Sign In
      </button>
    </form>
  );
}
