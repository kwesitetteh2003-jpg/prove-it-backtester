# Submission checklist: Vultr Agent Rush (lablab.ai), track "Blast Radius Zero"

Re-checked 23 Oct 2026 against https://lablab.ai/ai-hackathons/vultr-hackathon and https://lablab.ai/hackathon-rules. All times are **Accra time (UTC+0)**.
Status key: DONE = exists in repo, TODO = Rufus, GAP = a rule or quality risk to resolve, UNVERIFIED = could not confirm.

## 1. Dates (Accra time)
| Item | Date | Status |
|---|---|---|
| Registration closes | Tue 3 Nov 2026, 15:00 | UNVERIFIED: this was in earlier research, but the live event page now shows only "Online build 3-8 Nov" and "Event schedule: To be announced". Enrol as early as the Enroll button works; don't wait. |
| Online build window | Tue 3 Nov to Sun 8 Nov | Stated on the page (time of day not stated) |
| Submissions close | Sun 8 Nov 2026, 22:00 | UNVERIFIED on the live page; the rule book allows a 5-minute grace period only. Aim to submit by Sun 8 Nov 12:00. |
| On-site phase, Salt Lake City | 8 Nov | By approval only; travel and accommodation not covered. Ignore unless you want to apply (visa and travel are on you). |
| $200 Vultr credit gift code | shared at kickoff | Credits only appear after kickoff, so full Vultr deployment realistically happens 3-8 Nov unless you pay for a VM earlier. |

## 2. Eligibility
| Rule | Finding | Status |
|---|---|---|
| Country restrictions | None stated on the event page or in the general rule book ("Everyone is welcome", 180+ countries on lablab). Ghana is not excluded anywhere I could read. | OK, but the Enroll flow or Discord may add terms. Read them on enrolment. |
| Team size | 1-6; solo is fine | OK |
| Original and MIT-compliant | Footer says submissions "must be original and MIT-compliant". Repo is MIT. | OK |
| Code written before the event | The repo was built on 23 Oct, before the 3 Nov start. The pages I could read do not forbid pre-existing code, but they don't address it either. Some lablab events require work done during the hackathon. | UNVERIFIED. Ask in the lablab Discord/organizers before investing in submission (a one-line question). To be safe, do meaningful new work during 3-8 Nov (deployment, the LLM integration in G1/G2, polish), and say honestly in the description what was built when. |
| Prize payment | "Prize distribution may take up to 90 days"; KYC/payout method unknown. | Note |
| Vultr account | Needs an email **never used** on Vultr before | TODO |

## 3. Required Vultr technology (Challenge 1)
| Requirement | Prove-It today | Status |
|---|---|---|
| Vultr VM backend deployment | Docker image, compose file, `docs/DEPLOY_VULTR.md` exist; never deployed | TODO |
| Web app deployed on Vultr, Vultr as the central control layer, not just static hosting | API + sandbox supervisor + web all run on the VM | OK once deployed |
| Public demo URL | none yet | TODO |
| **Vultr Serverless Inference for agent LLM calls** | Hook exists (`server/src/llm/client.ts`), OpenAI-compatible, base URL default is the Vultr one, but **off by default, never run against a live key** | **GAP G1** |
| Isolated sandbox execution (Docker strongly recommended; OpenSandbox, gVisor, E2B, Microsandbox are named examples) | Child process under Node permission model, empty env, caps, SIGKILL, scratch dir destroyed; optional netns. The app can sit in a hardened Docker container (read-only, cap_drop ALL, no-new-privileges). Docker per run is not used. | **GAP G3** (judging risk, not a rule failure) |
| Containment focus: process isolation, secret hygiene, resource limits, lifecycle discipline | All four implemented and tested (40 tests incl. sandbox) | DONE |
| Vultr GPUs | Not available at this event, not needed | n/a |

## 4. Submission fields (form on lablab.ai)
| Field | Where | Status |
|---|---|---|
| Project title | DESCRIPTION.md | DONE |
| Short description | DESCRIPTION.md (~50 words; check the form's character limit) | DONE |
| Long description | DESCRIPTION.md | DONE (update the Vultr section after deploying) |
| Technology and category tags | DESCRIPTION.md | DONE |
| Cover image (16:9, optional) | spec in SLIDES_OUTLINE.md | TODO (screenshot from the deployed app) |
| Video presentation (MP4/MOV) | script in DEMO_SCRIPT.md | TODO (Rufus records; 3-5 min target, under 5) |
| Slide presentation (PDF) | outline in SLIDES_OUTLINE.md | TODO (build + export PDF) |
| Public GitHub repository, with setup and documentation | README.md, SETUP.md, docs/DEPLOY_VULTR.md | TODO: create the public repo and push (no remote is set; I did not push anything). Check `.env` is not committed. |
| Demo application platform | "Vultr Cloud Compute" | TODO after deploy |
| Application URL | none yet | TODO |
| Clear architecture and use-case explanation | DESCRIPTION.md, README architecture, slide 6 | DONE |
| One containment moment shown in the video | Containment Lab, shot 8 | Scripted; TODO record |
| Register on lablab.ai **and** the lablab Discord (both are asked) | n/a | TODO |

## 5. Judging criteria (rule book; the event page lists these four)
| Criterion | Where Prove-It stands | Risk |
|---|---|---|
| Application of Technology: "how effectively the chosen model(s) are integrated" | Model is optional and only parses text to JSON; no model in the explain/verify steps | High until G1 and G2 are done |
| Presentation (video + PDF): problem, solution, value, market, future goals, competitive analysis, under 5 min; **under 3 min scores "Limited"** | Script is 3:45; slides cover each | Medium; market and competition slides need your own sourced facts |
| Business Value | Plausible niche (retail trading verification, agent-safety tooling) but no users, revenue or validation | Medium |
| Originality | **The Vultr page itself lists "Prove-It" as an example direction**, so other teams may build something similar | Medium; differentiate with the honesty checks, Containment Lab and replay (slide 8) |

## 6. Gaps to resolve (ranked)
**G1: Vultr Serverless Inference must be live.** Challenge 1 says it is required for agent LLM calls. Today it is a switch that is off, with a model call that has never run. Without it the project may not meet the stated technology requirement. Fix: get the key (needs the account), set `LLM_ENABLED=true`, `LLM_MODEL=<id from /v1/models>`, test several prompts, watch for parse failures (the client sends `max_tokens`; Vultr's docs use `max_completion_tokens`, and reasoning models may emit extra text; the code strips code fences and validates strictly, and falls back to rules on any error). Show "LLM <model>" in the video. Effort: about 1-2 hours once the key exists.

**G2: The model only appears in step 2.** The Vultr "Pattern A" is: user asks, model writes code, code runs in a container, real output returns, **model explains the result**, errors fed back for retries. Prove-It has no "model explains the result" step and no retry loop. Suggested small addition (not done; needs the key to test): after the report, send the model the metrics and honesty checks (data only) and have it write a three-sentence plain-English explanation, shown under the verdict with a "written by <model>" label, falling back to a template. Effort: about 1-2 hours. This directly improves "Application of Technology".

**G3: "Docker strongly recommended" vs Node permission model.** Be ready to explain why a per-run Node-permission child process is a defensible isolation choice for a fixed engine that runs only trusted code on untrusted data, and to be precise that the model never writes code here. A stronger option (more work, optional): run each backtest in a short-lived Docker container started by the supervisor. Don't claim it unless built.

**G4: Untested pieces.** Dockerfile/compose never built (no Docker on the build box); the Vultr guide is from docs, not executed; the `read_only` container + Node permission model + `/tmp` scratch combination should be checked on the VM first. First thing to do on the VM: `docker compose up -d --build`, then Containment Lab → Run all six.

**G5: Network layer in Docker.** By default shows "not available" and the phone-home probe reports the network as reachable. Pick an option from SETUP.md section D and say it truthfully on camera.

**G6: Demo-script facts.** README's demo table says the "stopped working in the later period" moment happens on the Ethereum example; on today's data ETH lost money in both halves, and the later-period failure shows on Bitcoin. DEMO_SCRIPT.md uses the correct pairing. Re-read all quoted numbers from your own screen before recording.

**G7: Rate limits.** 40 backtests per minute per IP and 4 concurrent sandboxes. Judges behind a shared IP could hit 429/503. Consider raising limits for the judging period (env `RATE_LIMIT_PER_MIN`, `MAX_CONCURRENT_SANDBOXES`) on a 2 GB VM.

## 7. Test and runtime check, 23 Oct 2026 (build box, Node 20.19.2)
- `npm install`: ok (the `node_modules` folder was absent in this directory, so a fresh install was needed; not a code problem).
- `npm test`: **40/40 passed** (parser 8, engine 17, API 9, sandbox 6).
- `npm run build`: ok. `npm start` (run on port 8799 to avoid the other projects; stopped by PID afterwards): `/api/health` ok, `/` returns 200, `/api/config` shows all six sandbox layers enforced on this box (including network namespace).
- API walk-through: parsing the Ethereum prompt, backtests on ETH and BTC, and all six containment probes behaved as described in the demo script (env/fs/spawn/net blocked; loop and memory killed).
- Not tested: Docker, Vultr, the LLM hook, the web UI in a browser (API only; the UI was not clicked through this run).
- Nothing broken found. One docs inconsistency (G6).

## 8. What Rufus must do next (Accra time)
1. **Now to Tue 3 Nov: ask organizers** (lablab Discord) whether pre-built code is allowed, and confirm the real registration and submission deadlines (one message; I can draft it for you to send).
2. **Create the public GitHub repo** and push `prove-it-backtester` (confirm `.env` and zips are not included). By Fri 30 Oct.
3. **Click Enroll on the lablab event page** and join the lablab Discord. **Deadline: Tue 3 Nov 15:00** (unverified; do it by Mon 2 Nov).
4. **Create a Vultr account** with a never-used email; redeem the $200 gift code at kickoff (Tue 3 Nov); create the Serverless Inference key.
5. **Deploy on a Vultr VM** (SETUP.md C), choose the network-layer option, point a domain or nip.io name at it. Target: done by Wed 4 Nov evening.
6. **Make Vultr Serverless Inference live (G1) and ideally add the explain step (G2)**, then update DESCRIPTION.md and the README "Real vs mocked" table. Target: Thu 5 Nov.
7. **Re-run the demo script on the deployed URL; record the video** (3-5 min, MP4/MOV). Target: Fri 6 Nov.
8. **Build the slides, export the PDF, take the cover image.** Target: Sat 7 Nov.
9. **Submit on lablab.ai** with the repo, URL, video, PDF, descriptions, tags. Aim for **Sun 8 Nov by 12:00**; hard deadline **Sun 8 Nov 22:00** (+5 min grace).

Reminder: nothing in this package signs up, creates accounts, spends money or submits anything. Those steps are yours.
