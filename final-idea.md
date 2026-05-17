Direct answer: Shadow.

  Here's why on both axes.

  True innovation: I genuinely have not seen "shadow your workspace and let AI run wild on a copy, then diff-and-promote" anywhere. Git branches for data is old (Dolt,
  etcetera). Git for AI agents acting on structured workspaces is new. The closest neighbors — Backtest (in Reflex) and dataset versioning — both miss the
  live-AI-agent-acting-on-a-mirror angle. This is a new category, not a new feature.

  The other three are honestly less original on this axis:
  - Loop is Claude Code's TodoWrite pattern transposed to Notion pages. Beautiful, but conceptually borrowed. Anthropic could ship "Custom Agent renders task list on a page" as
  a Notion AI built-in next quarter and your project becomes table stakes.
  - Mission Control lives in an existing category (agent observability — LangSmith, Helicone, Langfuse). The Notion-native surface is fresh but the concept isn't.
  - Brain is the biggest concept but the innovation is about MCP, not Notion specifically. Notion is the storage; the protocol is the magic.

  Best use of Notion tech: Shadow is the only one where Workers' specific primitives are load-bearing. Look at what it actually needs:
  - worker.sync() with mode "replace" — literally the platform's tool for "maintain a parallel state representation"
  - worker.database() with primaryKeyProperty for shadow/real key matching
  - Custom Agent tool: "let AI rewrite the shadow"
  - A diff Worker: walks shadow vs real, structured comparison
  - Promote Worker: applies selected diff entries via Notion API

  You could not build this without Workers. You could not build this without Notion's structured DBs. Every primitive earns its keep. The other ideas could partially be done as
  a regular API integration; Shadow needs the substrate.

  Anthropic angle on Shadow: "Let AI experiment on a copy, promote what works" is the cleanest answer to the #1 enterprise objection to agents — I am scared to let AI touch my
  real data. That maps directly to Anthropic's safety positioning. The Anthropic judges (especially Anthony Morris on Claude Code) will see this as the missing safety layer
  above their tool-use loop.

  The demo IS cinematic if you build it right: split-screen Notion. Left pane: real DB ("Customer Requests"). Right pane: shadow DB. You say to the Custom Agent: "Triage all of
  these — assign owners, set priority, draft first responses." Watch the shadow fill with AI's changes in real-time. Switch to "Diff view" — structured diff appears. Click rows
  individually to accept or reject. Hit "Promote selected" — the chosen changes flow into the real DB. 60 seconds, three big moments (shadow fills, diff appears, promotion
  lands).

  The viral one-liner writes itself: "Git for your workspace, plus AI. Let agents experiment freely on a copy. Promote what works."

  Honest caveat: Brain has a higher absolute ceiling if it works (universal cross-tool memory is bigger than workspace versioning) — but the MCP-over-Workers transport is
  unverified and a cross-tool live demo is the most fragile demo type. Shadow is the better risk-adjusted bet at <12h.

  Want to lock Shadow in? I'll move to premise challenge and design doc.
