# 002 — Passkey manual smoke (real-device validation)

Background: virtual-authenticator E2E (`tests/e2e/passkey-flow.common.spec.ts`)
proves the wire format and the UI flow. Real biometrics + cross-device QR
must be exercised by a human at least once per release, on the platforms
we list as supported.

## Targets

- macOS Safari + Touch ID
- macOS Chrome + Touch ID
- iPhone Safari + Face ID
- Windows Chrome + Windows Hello (PIN or fingerprint)
- Android Chrome + screen lock
- iPhone → Windows cross-device sign-in via QR (hybrid transport)

## Pre-checks

1. Site loads at https://pyaserv.com and shows the Sign in link.
2. /api/auth/passkey/discover/options returns `{challengeId, options}` with
   `allowCredentials: []` (curl smoke):
   ```bash
   curl -sX POST https://api.pyaserv.com/api/auth/passkey/discover/options | head
   ```
3. localStorage `pyaserv.passkey.dismissedUntil` is unset (or expired) so
   the enroll prompt is allowed to appear.

## Scenario A — first-time enrollment after OTP

1. Open `https://pyaserv.com/login/` in a clean profile (no existing
   passkeys for the RP).
2. Enter a real email you control (anything @gmail / @yahoo etc — Resend
   is verified for pyaserv.com, sends to any address). Submit.
3. The verify form appears. Wait for the OTP email (subject contains the
   6-digit code + brand). Paste the code, Confirm.
4. **Expect**: an "Save this device for next time" card appears with
   platform-correct copy ("Face ID / Touch ID" on iOS, "Windows Hello"
   on Windows, etc.).
5. Tap "Guardar / Save". The native OS prompt fires.
6. Approve with biometric.
7. **Expect**: redirect to /me/, page shows authed (Sign out button visible).
8. Scroll to "Seguridad — Passkeys": the new entry is listed with its
   browser-on-OS label and "hace un momento" timestamp.

## Scenario B — subsequent login uses the passkey, no OTP

1. Sign out from /me/ (clears sessionStorage).
2. Open /login/ in the same profile.
3. Enter the SAME email. Submit.
4. **Expect**: the OS prompt fires immediately (no code-input UI). Approve.
5. **Expect**: redirect to /me/, signed in. No email roundtrip.

## Scenario C — Conditional UI autofill chip

1. Sign out. Open /login/ fresh.
2. Tap the email field WITHOUT typing.
3. **Expect** (Safari 16+, Chrome 108+ desktop): the autofill dropdown
   shows a passkey row labelled with the email. Tap it.
4. **Expect**: OS prompt → biometric → redirect to /me/, no email/code typed.

If the chip doesn't appear: `PublicKeyCredential.isConditionalMediationAvailable()`
must resolve true. Run in DevTools console:
```js
PublicKeyCredential.isConditionalMediationAvailable().then(console.log)
```

## Scenario D — cross-device (iPhone passkey, Windows browser)

1. On a fresh Windows Chrome profile, open /login/, enter the email, Submit.
2. **Expect**: OS prompt shows "Use a passkey on a different device" or
   a QR code (varies by browser version).
3. Scan the QR with the iPhone that owns the passkey.
4. Approve on iPhone with Face ID.
5. **Expect**: Windows session lands on /me/, signed in.

## Scenario E — cancel falls back to OTP

1. /login/, enter email with a known passkey, Submit.
2. When OS prompt appears, hit Cancel.
3. **Expect**: the page silently falls back to the OTP path — verify form
   appears with a fresh code in the mailbox.

## Scenario F — delete + re-enroll

1. /me/ → Seguridad → click "×" next to a passkey.
2. **Expect**: the row disappears; cooldown still set (no re-prompt).
3. Click "+ Agregar passkey". Approve.
4. **Expect**: a new entry with a fresh timestamp.

## Sign-off

| Tester | Browser × OS | Scenarios A–F | Date | Notes |
|---|---|---|---|---|
| | | | | |

Fill the table per device. Any unchecked row is a release-blocker.
