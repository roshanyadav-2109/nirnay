import type { Bidder, Criterion, Evaluation, VerdictStatus } from '../types';

export interface OverallVerdict {
  status: VerdictStatus;
  confidence: number;
  passedCount: number;
  failedCount: number;
  reviewCount: number;
  totalMandatory: number;
  totalOptional: number;
  reasoning: string;
}

export function computeOverallVerdict(
  evaluations: Array<Evaluation & { criterion?: Criterion }>,
): OverallVerdict {
  const mandatory = evaluations.filter((e) => e.criterion?.is_mandatory ?? true);
  const optional = evaluations.filter((e) => !(e.criterion?.is_mandatory ?? true));

  const passed = mandatory.filter((e) => e.status === 'eligible').length;
  const failed = mandatory.filter((e) => e.status === 'not_eligible').length;
  const review = mandatory.filter((e) => e.status === 'needs_review').length;

  let status: VerdictStatus;
  let reasoning: string;

  if (failed > 0) {
    status = 'not_eligible';
    reasoning = `${failed} mandatory criteria failed.`;
  } else if (review > 0) {
    status = 'needs_review';
    reasoning = `${review} mandatory criteria require human review.`;
  } else if (passed === mandatory.length && mandatory.length > 0) {
    status = 'eligible';
    reasoning = `All ${mandatory.length} mandatory criteria met.`;
  } else {
    status = 'needs_review';
    reasoning = 'No mandatory criteria evaluated yet.';
  }

  const confidences = mandatory.map((e) => e.confidence).filter((c) => Number.isFinite(c));
  const minConfidence = confidences.length ? Math.min(...confidences) : 0;

  return {
    status,
    confidence: minConfidence,
    passedCount: passed,
    failedCount: failed,
    reviewCount: review,
    totalMandatory: mandatory.length,
    totalOptional: optional.length,
    reasoning,
  };
}

export interface BidderRanking {
  bidder: Bidder;
  evaluations: Array<Evaluation & { criterion?: Criterion }>;
  overall: OverallVerdict;
  rank: number | null; // null => not_eligible or needs_review (unranked)
  score: number;
  reasoning: string;
  highlights: string[]; // bullet-point reasons (top criteria, optional wins, weaknesses)
}

const MANDATORY_CONF_WEIGHT = 0.7;
const OPTIONAL_PASS_WEIGHT = 0.3;

export function rankBidders(
  bidders: Bidder[],
  evaluationsByBidder: Map<string, Array<Evaluation & { criterion?: Criterion }>>,
): BidderRanking[] {
  // Build a ranking entry per bidder
  const entries: BidderRanking[] = bidders.map((b) => {
    const evals = evaluationsByBidder.get(b.id) || [];
    const overall = computeOverallVerdict(evals);

    const mandatory = evals.filter((e) => e.criterion?.is_mandatory ?? true);
    const optional = evals.filter((e) => !(e.criterion?.is_mandatory ?? true));

    const mandatoryConfs = mandatory.map((e) => e.confidence).filter((c) => Number.isFinite(c));
    const avgMandatoryConf =
      mandatoryConfs.length > 0
        ? mandatoryConfs.reduce((a, b) => a + b, 0) / mandatoryConfs.length
        : 0;

    const optionalsPassed = optional.filter((e) => e.status === 'eligible').length;
    const optionalRatio = optional.length > 0 ? optionalsPassed / optional.length : 0;

    const score = avgMandatoryConf * MANDATORY_CONF_WEIGHT + optionalRatio * OPTIONAL_PASS_WEIGHT;

    const highlights: string[] = [];

    if (overall.status === 'eligible') {
      highlights.push(
        `All ${overall.totalMandatory} mandatory criteria met (avg confidence ${(
          avgMandatoryConf * 100
        ).toFixed(0)}%).`,
      );
      if (optional.length > 0) {
        const passedOpts = optional.filter((e) => e.status === 'eligible');
        if (passedOpts.length > 0) {
          const labels = passedOpts
            .map((e) => e.criterion?.criterion_code)
            .filter(Boolean)
            .join(', ');
          highlights.push(`${passedOpts.length}/${optional.length} preferred criteria passed (${labels}).`);
        } else {
          highlights.push(`No preferred criteria passed (${optional.length} optional).`);
        }
      }
    } else if (overall.status === 'not_eligible') {
      const failed = mandatory.filter((e) => e.status === 'not_eligible');
      for (const f of failed) {
        const code = f.criterion?.criterion_code || '?';
        const reason = f.reasoning?.split('.')[0] || 'fails the threshold';
        highlights.push(`${code}: ${reason.trim()}.`);
      }
    } else {
      const review = mandatory.filter((e) => e.status === 'needs_review');
      for (const r of review) {
        const code = r.criterion?.criterion_code || '?';
        const reason = r.reasoning?.split('.')[0] || 'evidence ambiguous';
        highlights.push(`${code}: ${reason.trim()}.`);
      }
    }

    return {
      bidder: b,
      evaluations: evals,
      overall,
      rank: null, // populated below
      score,
      reasoning: '', // populated below
      highlights,
    };
  });

  // Sort eligible bidders by score (descending). Non-eligible are unranked.
  const eligible = entries
    .filter((e) => e.overall.status === 'eligible')
    .sort((a, b) => b.score - a.score);

  eligible.forEach((entry, idx) => {
    entry.rank = idx + 1;
    if (idx === 0) {
      entry.reasoning = `Recommended for award. Highest composite score (${(entry.score * 100).toFixed(
        1,
      )}/100) — ${entry.highlights.join(' ')}`;
    } else {
      const lead = eligible[0];
      const gap = (lead.score - entry.score) * 100;
      entry.reasoning = `Eligible alternative. Composite score ${(entry.score * 100).toFixed(
        1,
      )}/100, ${gap.toFixed(1)} points behind the recommended bidder.`;
    }
  });

  // Non-eligible entries
  for (const entry of entries) {
    if (entry.rank !== null) continue;
    if (entry.overall.status === 'not_eligible') {
      entry.reasoning = `Not eligible — ${entry.overall.failedCount} mandatory criteria failed. ${
        entry.highlights.join(' ') || ''
      }`.trim();
    } else if (entry.overall.status === 'needs_review') {
      entry.reasoning = `Cannot rank yet — ${entry.overall.reviewCount} criteria need officer review. ${
        entry.highlights.join(' ') || ''
      }`.trim();
    }
  }

  // Final order: ranked eligible first, then needs_review, then not_eligible
  return entries.sort((a, b) => {
    const order = (e: BidderRanking) =>
      e.overall.status === 'eligible' ? 0 : e.overall.status === 'needs_review' ? 1 : 2;
    const oa = order(a);
    const ob = order(b);
    if (oa !== ob) return oa - ob;
    if (a.rank != null && b.rank != null) return a.rank - b.rank;
    return b.score - a.score;
  });
}

export function verdictColor(status: VerdictStatus): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  switch (status) {
    case 'eligible':
      return {
        bg: 'bg-verdict-eligible-bg',
        text: 'text-verdict-eligible',
        border: 'border-verdict-eligible',
        label: 'Eligible',
      };
    case 'not_eligible':
      return {
        bg: 'bg-verdict-not-eligible-bg',
        text: 'text-verdict-not-eligible',
        border: 'border-verdict-not-eligible',
        label: 'Not Eligible',
      };
    case 'needs_review':
      return {
        bg: 'bg-verdict-review-bg',
        text: 'text-verdict-review',
        border: 'border-verdict-review',
        label: 'Needs Review',
      };
  }
}
