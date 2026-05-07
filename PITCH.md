# Nirnay — Pitch deck

> Every verdict, with evidence.
> AI-powered government tender evaluation built for the PanIIT AI for Bharat Hackathon, Theme 3 (CRPF Procurement).

---

## 01 · The problem

A CRPF procurement officer evaluating a single tender must read **8–12 eligibility criteria** across **5–15 bidders**, with each bidder submitting **6–10 supporting documents**. That is **~600 verdicts per tender**, each requiring the officer to:

1. Find the relevant fact in a 100+ page tender PDF.
2. Find the matching evidence in a stack of bidder PDFs.
3. Cross-check thresholds (Rs. 5 Cr turnover? ISO valid on bid date?).
4. Write a defensible justification on file.

This takes **~14 days per tender**. Decisions are **defensible by paper trail, not by data**. When a rejected bidder challenges in court, the officer must reconstruct *why* they decided what they decided — sometimes years later — from notes that have decayed.

> Existing AI tools either return black-box yes/no answers no officer can defend in court, or require expensive on-prem OCR + LayoutLM stacks that take 6 months to deploy.

---

## 02 · The two principles Nirnay refuses to compromise on

| Principle | Why it matters |
|---|---|
| **Citation on every verdict.** Every verdict points at the exact source quote, document name, and page number. | An officer must be able to defend the call in writing. No floating numbers. No "the AI said so." |
| **Never silently rejects.** If evidence is missing, the verdict is `needs_review`, never `not_eligible`. | Officers see exactly when the system doesn't know. The cost of a wrong rejection (legal, reputational) is far higher than the cost of a human review. |

These two constraints shape every other design decision.

---

## 03 · How it works

```
┌─────────────────┐   1. Tender PDF        ┌──────────────────────┐
│                 │ ───────────────────▶   │ Gemini 2.5 Flash     │
│   Officer       │   2. Bidder docs       │ (multimodal — reads  │
│   browser SPA   │ ◀───────────────────   │ PDFs natively)       │
│                 │   structured JSON      └──────────────────────┘
│                 │
│                 │   3. Per-bidder        ┌──────────────────────┐
│                 │      batch eval        │ Verdict engine       │
│                 │ ───────────────────▶   │ (deterministic TS,   │
│                 │ ◀───────────────────   │ no LLM in the loop)  │
│                 │      verdicts          └──────────────────────┘
│                 │
│                 │   4. Append-only       ┌──────────────────────┐
│                 │      hash-chained      │ Supabase             │
│                 │      audit log         │ (Postgres + Storage) │
└─────────────────┘ ───────────────────▶   └──────────────────────┘
```

* **No OCR pipeline.** Gemini multimodal reads PDFs natively — eliminates LayoutLMv3 + PaddleOCR + post-processing. One stage instead of five.
* **Aggregation is deterministic.** The LLM evaluates one criterion-bidder pair at a time. The verdict aggregator (eligible / not_eligible / needs_review) is pure TypeScript. The same evaluations always yield the same overall verdict — defensible.
* **Audit chain is browser-side.** SHA-256 via Web Crypto API. Every action chained: `event_hash = SHA-256(prev_hash + payload)`. Tampering at any byte is detected on one click.

---

## 04 · What it's *not* doing (and why)

| We don't | Because |
|---|---|
| Use GPT-4 long context | Gemini 2.5 Flash is free up to 1500 req/day; the problem doesn't need a frontier model |
| Build a custom OCR pipeline | Gemini is multimodal — PDFs go in, structured JSON comes out |
| Use the LLM for the final verdict | Aggregation is deterministic so two officers re-running get bit-for-bit identical results |
| Write our own auth | Supabase RLS is permissive in POC; production swaps to `auth.uid()` |
| Do anything fancy for retrieval | The whole tender + bidder set fits in 1M-token context — RAG is unnecessary at this scale |

---

## 05 · Demo flow (2 minutes, on stage)

1. **Open the dashboard** — judges see the metrics panel: tenders processed, verdicts produced, officer-hours saved.
2. **Click a tender card** → criteria already extracted (10 eligibility criteria, all citation-tagged to source pages).
3. **Click Evaluation** → 5 bidders listed, "Run evaluation" button → **2 seconds** in demo mode (cached) or ~10s live with batched + parallel eval.
4. **Click any verdict** → evidence panel shows the *exact source quote* from the bidder's CA certificate / ISO certificate / bank guarantee, with doc name and page reference.
5. **Click Audit Trail** → 60+ events, all hash-chained.
6. **Click "Simulate tampering"** → one row's payload is mutated directly via SQL.
7. **Click "Verify chain"** → the corrupted row turns red. *The system caught it.*

---

## 06 · Quantified impact

|                              | Manual baseline | Nirnay |
|------------------------------|----------------:|-------:|
| Time per tender (5 bidders)  | 14 days         | **~6 minutes** with cached, ~80s live |
| Citation coverage            | 0%              | **100%** |
| Audit-trail completeness     | Decays over time | **Permanent, hash-chained** |
| Tamper detection             | None            | **One-click verifiable** |
| Cost per tender              | ₹X officer-time | < **₹50** in API spend |

For a CRPF procurement directorate processing ~120 tenders a year:

* **Before:** 120 × 14 days = **1680 officer-days/year** of evaluation time.
* **After:** 120 × 1 day (review + override) = **120 officer-days/year**.
* **Saved:** 1560 officer-days. At 8 working hours/day, that's **12,480 officer-hours** redirected to higher-judgement work (negotiation, site inspection, contract management).

---

## 07 · Roadmap

* **Q3 2026 — Production hardening:** auth.uid()-scoped RLS, signed URLs for storage, role-based access (officer / auditor / read-only).
* **Q4 2026 — On-prem variant:** swap Gemini for Llama 3.1 70B via vLLM for air-gapped MoD environments.
* **Q1 2027 — pgvector RAG:** index every prior verdict; surface "we made a similar call last year" suggestions to officers.
* **Q2 2027 — GeM integration:** pull tenders directly from the Government e-Marketplace API; close the loop with electronic procurement.
* **Multilingual:** Indic OCR support (handwritten regional language documents) via dual-engine LayoutLMv3 fallback when Gemini confidence is low.

---

## 08 · The ask

Nirnay is open source under MIT. We'd like to:

1. **Pilot it with one CRPF directorate** (or any paramilitary procurement cell) on real (sanitised) tender data for 4–6 weeks.
2. **Open-source the prompts and verdict engine** so the citation-discipline pattern can be reused beyond procurement (legal contracts, insurance claims, grant applications).
3. **Get feedback from procurement officers** on the override flow and the audit UI.

---

### Built by

Roshan Yadav · solo build for PanIIT AI for Bharat 2026.
GitHub: `github.com/roshanyadav-2109/nirnay` · License: MIT.
