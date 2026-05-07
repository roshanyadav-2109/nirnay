import type { Criterion, Evaluation, VerdictStatus } from '../types';

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
