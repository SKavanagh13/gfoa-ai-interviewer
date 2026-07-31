import crypto from "node:crypto";

export const SIDEBAND_DISPATCH_SECRET_HEADER = "x-sideband-dispatch-secret";

export function sidebandDispatchSecretMatches(
  expectedSecret: string,
  providedSecret: string | undefined,
): boolean {
  if (!providedSecret) {
    return false;
  }

  const expected = Buffer.from(expectedSecret);
  const provided = Buffer.from(providedSecret);

  return (
    expected.length === provided.length &&
    crypto.timingSafeEqual(expected, provided)
  );
}
