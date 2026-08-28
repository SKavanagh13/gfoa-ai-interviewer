"use client";

import { useActionState } from "react";
import { confirmAdminPasswordRecovery } from "@/app/admin/recover/actions";
import { initialAdminRecoveryState } from "@/app/admin/recover/state";

type AdminRecoveryFormProps = {
  next: string;
  tokenHash: string;
};

export function AdminRecoveryForm({ next, tokenHash }: AdminRecoveryFormProps) {
  const [state, formAction, pending] = useActionState(
    confirmAdminPasswordRecovery,
    initialAdminRecoveryState,
  );

  return (
    <form action={formAction} className="form-stack panel admin-login-form">
      <input name="tokenHash" type="hidden" value={tokenHash} />
      <input name="next" type="hidden" value={next} />
      <p className="muted">
        Continue only if you requested a password reset for this admin account.
      </p>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button disabled={pending} type="submit">
        Continue to Password Reset
      </button>
    </form>
  );
}
