# 00 — Context

> **M0 update, 2026-10-09:** game planning belongs to this repository. Read
> [the current decisions](08-decisions.md) and [construction plan](10-construction-proposal.md)
> before applying older details below. The fair QR opens the game directly: enter a visitor
> name, see/explore the galaxy and access other actions, then optionally choose creation.
> The assistant is entirely out of current scope. Game naming, final route and detailed
> interaction design remain for the dedicated design session. Old dates are not a work schedule.

## The event

**BAD Day 2026 — "Be a Dragon"**, Universidad San Francisco de Quito (USFQ). Be a Dragon is USFQ's
open house (*casa abierta*) with a project fair. The operator participates in the **Computación**
category. Motivation: an **extra point** (academic) plus a portfolio piece.

The call, as given to participants (Spanish, verbatim):

> ¿Tienes un proyecto o una idea que quieras llevar más lejos? Puedes participar solo o en pareja,
> escoger tu categoría y preparar una demo de tu proyecto.
> Computación: apps, videojuegos, software, ciberseguridad, bases de datos, IoT, sistemas
> distribuidos, IA, integración hardware–software y más.

- Application deadline: 2026-10-04 — **submitted**.
- **Everything must be finished by 2026-10-21.** The exact fair date was not confirmed during
  planning. The operator owns scheduling; no calendar-day work allocation is prescribed.
- Audience assumption: an open house brings prospective students (high-school age) and families, plus
  USFQ students and faculty. Design for **walk-up use with zero instructions**, short attention, noisy
  environment, phones on mobile data or event Wi-Fi.

## What the operator wants from it

1. A visible "wow" for the public at the booth.
2. Something that **adds to his portfolio** and keeps working after the fair.
3. The fair QR opens **the game directly**, under the portfolio domain. Visitors enter their
   name, see/explore the galaxy and its available actions, and can choose creation later.
   Links to the profile and social networks are available; a portfolio visit is not a prerequisite.
   People discovering the portfolio independently may also navigate to the game from there.
4. The current priority is the galaxy, followed by the portfolio. The assistant described in
   the historical submission below is entirely outside the current work.

## The application as submitted (Sección 4)

> Drafted in the planning session; the operator submitted the form afterwards. **Operator: confirm
> the submitted text matches; if not, replace this section with what was actually sent.** The build
> must deliver what was promised here.

**10. Título tentativo del proyecto**
Galaxia Colectiva

**11. Problema y solución (≤200 palabras)**
En una feria o en un portafolio web, el visitante suele ser un espectador: mira una demo, se va y no
queda nada de su paso ni un vínculo con quien hizo el proyecto.

Galaxia Colectiva es un evento en vivo dentro de mi página de portafolio. En la pantalla del stand hay
un sistema solar vacío y un código QR. Cada visitante entra desde su celular, sin instalar nada, diseña
un planeta, estrella o luna con su propio sonido y lo lanza a órbita con un gesto; si lo lanza mal, no
se destruye: se convierte en cometa. Puede editarlo durante todo el día, sembrar vida en planetas de
otros y, al agitar el celular, provocar auroras que todos ven en pantalla. Al terminar recibe una
postal digital de su objeto.

Todo queda registrado: el nacimiento de la galaxia se puede ver después como timelapse y cada objeto
queda visitable en mi portafolio, junto a mis proyectos y redes. Durante la presentación me acompaña
un asistente de voz con IA que conversa conmigo, controla la demo y puede aplicar correcciones al
código con verificación y reversión.

> **Note:** "sembrar vida en planetas de otros" was **removed from scope after submission** by the
> operator (see `01-product-spec.md` §Rejected). Fine for the fair; just don't promise it at the booth.

**12. Relación con la categoría (≤100 palabras)**
Es una aplicación web en tiempo real con varios clientes simultáneos: los celulares de los visitantes
escriben en una base de datos en la nube y la pantalla del stand sincroniza y renderiza la galaxia en
3D al instante. Incluye gráficos 3D en el navegador, síntesis de sonido procedural, uso de sensores del
celular (acelerómetro), reglas de seguridad y antispam sin servidor propio, y un agente de IA por voz
que ejecuta acciones sobre la demo y el computador, con pruebas automáticas y reversión de cambios.

**13. Herramientas, lenguajes, datos o hardware**
TypeScript, HTML/CSS; Three.js (React Three Fiber); Web Audio API (Tone.js); APIs de sensores del
navegador (DeviceMotion); Canvas para las postales. Firebase Hosting, Cloud Firestore, Firebase
Anonymous Auth y reglas de seguridad. Asistente: modelo de lenguaje con herramientas, reconocimiento
de voz (Whisper), síntesis de voz (Piper), Git y Playwright para pruebas y reversión. Hardware: laptop,
monitor o TV externo, micrófono de solapa y los celulares de los visitantes.

> **Note:** the lapel microphone was **dropped** after submission (operator has none). Voice input
> was then planned from phones instead (see the historical `../archive/04-assistant.md`).
> All assistant/voice work is now excluded from the current scope.

**14. Stand:** Monitor externo · Toma eléctrica · Conexión a internet por cable.
**15. ¿Llevarán su propio computador?** Sí.
