# rc2 visible string changes

The lead approved the Open Galaxy rename and fair-control removal. The session/error
copy below was added by rc2.1 under the original admin brief and remains for the Opus review.
Layout and styles do not change. Identifiers such as `record.back.sandbox` stay stable.

| Catalog / language / key | Before | After |
| --- | --- | --- |
| galaxy / en / `story.bad-2026.paragraphs.4` | Want to launch your own? Go back to the shared sandbox. Everyone can play there. | Want to launch your own? Go back to the shared Open Galaxy. Everyone can play there. |
| galaxy / en / `record.back.sandbox` | Sandbox | Open Galaxy |
| galaxy / en / `record.back.sandbox.aria` | Back to the sandbox to create a body | Back to the Open Galaxy to create a body |
| galaxy / en / `record.fallback` | This sky preserves its visitors’ launches. Explore its history in the timelapse, or return to the sandbox to launch your own body. | This sky preserves its visitors’ launches. Explore its history in the timelapse, or return to the Open Galaxy to launch your own body. |
| galaxy / es / `story.bad-2026.paragraphs.4` | ¿Quieres lanzar tu propio astro? Vuelve al sandbox compartido. Allí todos pueden jugar. | ¿Quieres lanzar tu propio astro? Vuelve a la Galaxia abierta compartida. Allí todos pueden jugar. |
| galaxy / es / `record.back.sandbox` | Sandbox | Galaxia abierta |
| galaxy / es / `record.back.sandbox.aria` | Volver al sandbox para crear un astro | Volver a la Galaxia abierta para crear un astro |
| galaxy / es / `record.fallback` | Este cielo conserva los lanzamientos de sus visitantes. Recorre su historia en el timelapse o vuelve al sandbox para lanzar tu propio astro. | Este cielo conserva los lanzamientos de sus visitantes. Recorre su historia en el timelapse o vuelve a la Galaxia abierta para lanzar tu propio astro. |
| admin / en / `admin.booth` | Fair display | — |
| admin / en / `admin.setBooth` | Show at fair | — |
| admin / en / `admin.checkingSession` | — | Checking your session. Please wait; the sign-in controls will appear here. |
| admin / en / `admin.signingIn` | — | Complete Google sign-in in the popup. If it is closed, try again. |
| admin / en / `admin.popupBlocked` | — | Your browser blocked the Google sign-in popup. Allow popups for this site, then try again. |
| admin / en / `admin.popupClosed` | — | The Google sign-in popup was closed. Press Sign in with Google to try again. |
| admin / en / `admin.networkError` | — | Google sign-in could not connect. Check your internet connection, then try again. |
| admin / en / `admin.permissionDenied` | — | Administrator access was denied. Sign out and choose an invited Google account. |
| admin / en / `admin.domainError` | — | Google sign-in is unavailable on this address. Open the admin on the game’s own address and try again. |
| admin / en / `admin.retry` | — | Check your connection and try again, or sign out and choose an invited Google account. |
| admin / es / `admin.booth` | Pantalla de feria | — |
| admin / es / `admin.setBooth` | Mostrar en feria | — |
| admin / es / `admin.checkingSession` | — | Comprobando tu sesión. Espera; los controles de acceso aparecerán aquí. |
| admin / es / `admin.signingIn` | — | Completa el acceso con Google en la ventana emergente. Si se cierra, vuelve a intentarlo. |
| admin / es / `admin.popupBlocked` | — | El navegador bloqueó la ventana de Google. Permite ventanas emergentes en este sitio y vuelve a intentarlo. |
| admin / es / `admin.popupClosed` | — | Se cerró la ventana de Google. Pulsa Entrar con Google para volver a intentarlo. |
| admin / es / `admin.networkError` | — | No se pudo conectar con Google. Comprueba tu conexión e inténtalo de nuevo. |
| admin / es / `admin.permissionDenied` | — | Acceso de administrador denegado. Cierra sesión y elige una cuenta de Google invitada. |
| admin / es / `admin.domainError` | — | Google no está disponible en esta dirección. Abre el administrador en la dirección del juego e inténtalo de nuevo. |
| admin / es / `admin.retry` | — | Comprueba tu conexión e inténtalo de nuevo, o cierra sesión y elige una cuenta de Google invitada. |

The default manifest name changes from `Sandbox` to `Open Galaxy`; presentation shows
`Open Galaxy` in English and `Galaxia abierta` in Spanish, including old default manifests.
Custom galaxy names and frozen historical manifests retain their original names.

README prose changes `Visitors land in an open shared sandbox:` to `Visitors land in the shared Open Galaxy:`
and `an open current-kernel sandbox` to `a current-kernel Open Galaxy`.

The PR bot comment adds the preview URL and checked SHA, seven-day expiry, production-database
warning and the preview-domain Google sign-in limitation. This is workflow output, not product UI.


Additional rc2.1 authorization recovery copy in `integration/admin-store.js`:

- Before: “This Google account is not on the keeper’s allowlist.” After: “This Google account is not on the keeper’s allowlist. Sign out and choose an invited Google account.”
- New network/permission-probe fallback: “Could not check administrator access. Check your connection and try signing in again.”

The session-clock launch fix adds no visible wording.
