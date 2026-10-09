# 04 — The fair assistant ("adjutant")

The operator's companion at the booth. **Name: not chosen yet** (candidates floated: Bólido,
Kepler, Perihelio, Satélite — operator decides; use a config constant until then). The operator calls
this role his *adjutant*; see `C:\My Files\AKLabs\CASPIAN\governance\ADJUTANT.md` for the broader role contract
this is meant to grow into.

## What it is (and isn't)

- **It is the operator's companion and the show.** The public enjoys the conversations between the
  operator and the assistant. It also helps the operator for real during the fair.
- It is **not** a public object generator ("say it and it appears" was rejected).
- It must be **genuinely capable**: the operator wants to be able to ask it anything within its
  environment and have it resolved quickly, well-grounded and with quality. At the fair it acts
  through **closed, validated tools** for the galaxy and controlled capabilities for the laptop.
- The plan-session drafting of the application answers is the bar: that is how useful it should be.

## Personality

- Dry, butler-like humour **with hints of Wheatley (Portal 2)**: funnier, talkative, a bit insecure
  and overconfident at once. A **companion, not an obedient butler**. Teases the operator lightly in
  front of the public; may disagree.
- **Never interrupts:** it speaks only (a) in response to a push-to-talk message, or (b) to make an
  announcement when no push-to-talk is in progress. If a new message arrives while it is speaking,
  it stops.
- **No frustrating mistakes:** if unsure what was asked, it says so with a joke instead of guessing;
  in facts, says "I don't know" rather than inventing.
- Replies in the language it was spoken to (ES / EN / RU).

## Voice loop (no lapel mic — phones are the microphones)

```
phone (/galaxy/talk or /galaxy/create)                     booth laptop (apps/stand)
 hold-to-talk → MediaRecorder clip (≤ ~20 s, compressed)
 → base64 into Firestore assistant/inbox/{id}  ──────────►  listener picks it up
                                                            → STT (D8: local Whisper / cloud)
                                                            → brain (D2) with role-scoped tools
                                                            → TTS (Piper, deep voice) → laptop/TV speakers
 subtitles on screen  ◄──────── assistant/outbox/{id} ◄──  transcript + reply text
```

- Works regardless of networks (laptop on cable, phones on mobile data / Wi-Fi): Firestore is the
  relay; no phone↔laptop direct connection.
- **Realistic latency: ~2–4 s** from release of the button to hearing the reply. Measure it in the
  v0.5.0 spike and report the real figure; optimize (streaming LLM + streaming TTS) in v0.8.0.
- Screen shows a small voice-reactive orb + subtitles (helps in a noisy fair).
- Audio output: TV/monitor speakers by default (D9).

## Two roles — hard separation

| Role | How | Capabilities |
|---|---|---|
| **Owner** (Alexander) | `/galaxy/talk`, Google sign-in; rules require `uid == config/live.ownerUid` | Levels N0–N3 below |
| **Public** | hold-to-talk button in `/galaxy/create` | Conversation + read-only galaxy questions. **Runs in a separate session with no tools at all.** |

Public input is untrusted text: it can never reach a session that has tools (prompt-injection
boundary). Public talk can be disabled with the `assistantPublic` kill switch.

## Permission levels (owner)

- **N0 — free:** conversation; closed galaxy tools (focus/spotlight an object, switch screen scene,
  show big QR, start/stop timelapse, count objects/creators, trigger a meteor shower, read stats);
  **anything inside its own workspace folder** (notes, contacts of people met at the fair, drafts,
  summaries, scripts).
- **N1 — free, logged:** laptop control — open a URL on a given monitor, move a window to the
  extended TV, fullscreen, switch windows. Operator's own examples: "show them the page on the laptop
  screen", "put the join QR on the extended TV". Implementation: a Playwright-controlled Chrome for the booth
  windows + PowerShell for Windows window management.
- **N2 — needs the operator's spoken "apply":** code changes, via the fix pipeline below.
- **N3 — needs a tap confirmation on the operator's phone:** changes to security rules, data, or
  Firebase configuration.

**Hard boundaries:** no access to the operator's Google accounts, phone contacts, email or any
external account. Filesystem access limited to its workspace folder and the `portfolio` + `galaxy`
checkouts (code only via the fix pipeline). Workspace folder location: operator decides (default
`C:\My Files\AKLabs\Fawns\assistant-workspace\`, git-ignored from both repos).

Every action is appended to a local action log the operator can review after the fair.

## Live code-fix pipeline (N2)

"There's a bug, can you fix it?" →
1. Work on a `hotfix/*` branch in the relevant local checkout.
2. Run typecheck, lint, unit tests, rules tests, build.
3. Run the Playwright smoke test (emulated phone: create → launch → appears on screen).
4. Deploy to a **preview channel**; smoke-test the preview URL.
5. Summarize the change by voice (what, why, risk) and wait for "apply".
6. Promote to production with `portfolio/scripts/deploy-local` (live-safe, see 05).
7. Merge of the hotfix branch to `main` happens afterwards, per the operator's instruction; the hotfix deploys from the
   branch.
8. **Rollback** = one command: restore the previous Hosting version + `git revert` on the branch.

Rules/data/config changes are never part of an N2 fix; they escalate to N3.

## Brain (D2 — default pending operator confirmation)

Default: **Claude Agent SDK** as the brain (tool-calling agent with the tool sets above), and
**Claude Code headless** (`claude -p`) inside the hotfix worktree for code changes. Requires an
Anthropic API key (operator; has a cost). Alternative: route through CASPIAN. Migrating to CASPIAN
later stays possible because tools are defined in `apps/stand` independently of the brain.

## End-of-fair report (example of N0 work)

On request: creators per hour, objects, launches/relaunches, interactions (from galaxy data — **no
camera**), the contacts/notes it took ("note that the physics professor was interested in MunHub"),
and anything else asked — written into its workspace folder.
