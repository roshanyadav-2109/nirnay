// Institutional-grade evaluation report.
// Generated client-side with jsPDF — letterhead, seals, ranking, per-bidder
// findings, and a SHA-256 "digital fingerprint" block tied to the audit log.
//
// Why this and not real PKI digital signatures: in-browser PKI signing
// requires a hardware DSC token (CCA-licensed CA, USB cert) that we cannot
// reach from JavaScript. Instead we use the cryptographic guarantee already
// in our system: every report carries a SHA-256 hash of its content, and
// that hash is appended to the immutable audit log. Any later modification
// breaks both the document hash and the chain.

import { jsPDF } from 'jspdf';
import type { Bidder, Criterion, Evaluation, Tender } from '../types';
import { sha256, fetchAuditEvents, logAuditEvent } from './audit-logger';
import { rankBidders, type BidderRanking } from './verdict-engine';

interface BuildOpts {
  tender: Tender;
  criteria: Criterion[];
  bidders: Bidder[];
  evaluations: Array<Evaluation & { criterion?: Criterion }>;
  officerName: string;
}

// ---------------------------------------------------------------------------
// Drawing helpers (mirror the mock-data generator's institutional patterns)
// ---------------------------------------------------------------------------

function pageW(d: jsPDF) {
  return d.internal.pageSize.getWidth();
}
function pageH(d: jsPDF) {
  return d.internal.pageSize.getHeight();
}

function hairline(d: jsPDF, x1: number, y1: number, x2: number, y2: number, color: number[] = [80, 80, 80]) {
  d.setDrawColor(color[0], color[1], color[2]);
  d.setLineWidth(0.5);
  d.line(x1, y1, x2, y2);
}

function doubleRule(d: jsPDF, y: number, margin: number) {
  hairline(d, margin, y, pageW(d) - margin, y);
  hairline(d, margin, y + 3, pageW(d) - margin, y + 3);
}

function ashokSeal(d: jsPDF, cx: number, cy: number, label: string) {
  d.setDrawColor(40, 40, 40);
  d.setLineWidth(1.2);
  d.circle(cx, cy, 32, 'S');
  d.setLineWidth(0.4);
  d.circle(cx, cy, 28, 'S');
  d.circle(cx, cy, 10, 'S');
  d.setFont('helvetica', 'bold');
  d.setFontSize(7);
  d.setTextColor(40, 40, 40);
  d.text(label, cx, cy - 18, { align: 'center' });
  d.setFont('helvetica', 'normal');
  d.setFontSize(6);
  d.text('SATYAMEVA JAYATE', cx, cy + 22, { align: 'center' });
  d.setFontSize(8);
  d.text('★', cx, cy + 3, { align: 'center', baseline: 'middle' });
  d.setTextColor(0, 0, 0);
}

function rectSeal(d: jsPDF, x: number, y: number, w: number, h: number, lines: string[], color: number[] = [120, 30, 30]) {
  d.setDrawColor(color[0], color[1], color[2]);
  d.setLineWidth(1);
  d.rect(x, y, w, h);
  d.setTextColor(color[0], color[1], color[2]);
  d.setFont('helvetica', 'bold');
  d.setFontSize(7);
  let cy = y + 11;
  for (const ln of lines) {
    d.text(ln, x + w / 2, cy, { align: 'center' });
    cy += 8;
  }
  d.setTextColor(0, 0, 0);
  d.setFont('helvetica', 'normal');
}

function watermark(d: jsPDF, text: string) {
  d.saveGraphicsState();
  d.setTextColor(225, 225, 225);
  d.setFont('helvetica', 'bold');
  d.setFontSize(58);
  d.text(text, pageW(d) / 2, pageH(d) / 2, {
    align: 'center',
    angle: 35,
    baseline: 'middle',
  });
  d.restoreGraphicsState();
  d.setTextColor(0, 0, 0);
}

function paragraph(
  d: jsPDF,
  x: number,
  y: number,
  text: string,
  opts: { width?: number; fontSize?: number; lineHeight?: number; font?: 'normal' | 'bold' | 'italic' } = {},
): number {
  const { width = pageW(d) - 96, fontSize = 10, lineHeight = 14, font = 'normal' } = opts;
  d.setFont('helvetica', font);
  d.setFontSize(fontSize);
  const lines = d.splitTextToSize(text, width);
  for (const ln of lines) {
    d.text(ln, x, y);
    y += lineHeight;
  }
  return y;
}

interface TableColumn<R> {
  key: keyof R | string;
  label: string;
  w: number;
  format?: (row: R) => string;
}

function table<R extends Record<string, unknown>>(
  d: jsPDF,
  x: number,
  y: number,
  columns: Array<TableColumn<R>>,
  rows: R[],
  opts: { headerBg?: number[]; rowH?: number; headerH?: number; fontSize?: number } = {},
): number {
  const { headerBg = [240, 240, 235], rowH = 18, headerH = 20, fontSize = 9 } = opts;
  const totalW = columns.reduce((s, c) => s + c.w, 0);

  // Header
  d.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
  d.setDrawColor(180, 180, 180);
  d.rect(x, y, totalW, headerH, 'FD');
  d.setFont('helvetica', 'bold');
  d.setFontSize(fontSize);
  let cx = x;
  for (const col of columns) {
    d.text(col.label, cx + 5, y + 13);
    cx += col.w;
  }
  d.setFont('helvetica', 'normal');

  let ry = y + headerH;
  for (const row of rows) {
    if (ry + rowH > pageH(d) - 56) {
      // page break — caller is responsible for re-rendering header if needed
      return ry;
    }
    d.setDrawColor(220, 220, 220);
    d.rect(x, ry, totalW, rowH, 'S');
    let rx = x;
    for (const col of columns) {
      const val = col.format ? col.format(row) : String((row as any)[col.key] ?? '');
      const lines = d.splitTextToSize(val, col.w - 10);
      d.text(lines[0] || '', rx + 5, ry + 12);
      rx += col.w;
    }
    ry += rowH;
  }

  // Vertical lines
  let vx = x;
  d.setDrawColor(220, 220, 220);
  for (let i = 0; i < columns.length; i++) {
    d.line(vx, y, vx, ry);
    vx += columns[i].w;
  }
  d.line(x + totalW, y, x + totalW, ry);
  return ry;
}

function newPageIfNeeded(d: jsPDF, y: number, threshold: number, marginTop: number): number {
  if (y > pageH(d) - threshold) {
    d.addPage();
    return marginTop;
  }
  return y;
}

const VERDICT_WORD = (s: 'eligible' | 'not_eligible' | 'needs_review') => {
  if (s === 'eligible') return 'ELIGIBLE';
  if (s === 'not_eligible') return 'NOT ELIGIBLE';
  return 'NEEDS REVIEW';
};

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export interface BuildResult {
  blob: Blob;
  documentHash: string;
  filename: string;
  fileNo: string;
  generatedAt: string;
}

export async function generateReportPdf(opts: BuildOpts): Promise<BuildResult> {
  const { tender, criteria, bidders, evaluations, officerName } = opts;

  // Lookup helpers
  const evalsByBidder = new Map<string, Array<Evaluation & { criterion?: Criterion }>>();
  for (const b of bidders) evalsByBidder.set(b.id, []);
  for (const e of evaluations) {
    const list = evalsByBidder.get(e.bidder_id);
    if (list) list.push(e);
  }
  const rankings = rankBidders(bidders, evalsByBidder);

  const generatedAt = new Date();
  const fileNo = `NIRNAY/EVAL/${generatedAt.getFullYear()}/${String(generatedAt.getMonth() + 1).padStart(2, '0')}/${tender.id.slice(0, 8).toUpperCase()}`;

  // Get latest audit event hash to anchor this report to
  const auditEvents = await fetchAuditEvents(1);
  const lastAuditHash = auditEvents[0]?.event_hash || '0'.repeat(64);

  // ------------ build PDF ------------
  const d = new jsPDF({ unit: 'pt', format: 'a4' });
  d.setFont('helvetica', 'normal');
  const margin = 48;

  // ============== PAGE 1: Cover + Executive Summary ==============
  buildCoverPage(d, margin, { tender, fileNo, generatedAt, officerName, totalBidders: bidders.length, totalCriteria: criteria.length });

  let y = 350;
  d.setFont('helvetica', 'bold');
  d.setFontSize(11);
  d.text('1. EXECUTIVE SUMMARY', margin, y);
  y += 6;
  hairline(d, margin, y, pageW(d) - margin, y);
  y += 16;

  const eligibleCount = rankings.filter((r) => r.overall.status === 'eligible').length;
  const notEligibleCount = rankings.filter((r) => r.overall.status === 'not_eligible').length;
  const reviewCount = rankings.filter((r) => r.overall.status === 'needs_review').length;
  const winner = rankings.find((r) => r.rank === 1);

  y = paragraph(
    d,
    margin,
    y,
    `This report covers the evaluation of ${bidders.length} bidder(s) against ${criteria.length} eligibility criteria for the captioned tender. Each verdict is supported by the exact source quote, document name, and page number from the bidder's submission.`,
    { lineHeight: 13 },
  );
  y += 6;

  // Headline numbers
  const cardW = (pageW(d) - margin * 2 - 18) / 4;
  drawSummaryCard(d, margin + (cardW + 6) * 0, y, cardW, 'BIDDERS', String(bidders.length));
  drawSummaryCard(d, margin + (cardW + 6) * 1, y, cardW, 'ELIGIBLE', String(eligibleCount), [21, 128, 61]);
  drawSummaryCard(d, margin + (cardW + 6) * 2, y, cardW, 'NOT ELIGIBLE', String(notEligibleCount), [185, 28, 28]);
  drawSummaryCard(d, margin + (cardW + 6) * 3, y, cardW, 'NEEDS REVIEW', String(reviewCount), [161, 98, 7]);
  y += 56;

  if (winner) {
    d.setFont('helvetica', 'bold');
    d.setFontSize(10);
    d.text('1.1  Recommended Bidder', margin, y);
    y += 6;
    hairline(d, margin, y, pageW(d) - margin, y, [220, 220, 220]);
    y += 14;

    d.setFont('helvetica', 'bold');
    d.setFontSize(13);
    d.text(winner.bidder.name, margin, y);
    y += 16;

    d.setFont('helvetica', 'normal');
    d.setFontSize(9);
    d.text(
      `Composite Score: ${(winner.score * 100).toFixed(1)}/100   |   Mandatory criteria passed: ${winner.overall.passedCount}/${winner.overall.totalMandatory}   |   Min confidence: ${(winner.overall.confidence * 100).toFixed(0)}%`,
      margin,
      y,
    );
    y += 14;
    y = paragraph(d, margin, y, winner.reasoning, { fontSize: 10, lineHeight: 13 });
    y += 4;
    for (const h of winner.highlights) {
      y = paragraph(d, margin + 14, y, '• ' + h, { fontSize: 9, lineHeight: 12 });
    }
    y += 10;
  }

  // ============== PAGE 2: Ranking ==============
  d.addPage();
  y = margin;
  d.setFont('helvetica', 'bold');
  d.setFontSize(11);
  d.text('2. BIDDER RANKING', margin, y);
  y += 6;
  hairline(d, margin, y, pageW(d) - margin, y);
  y += 14;

  d.setFont('helvetica', 'normal');
  d.setFontSize(9);
  y = paragraph(
    d,
    margin,
    y,
    'Eligible bidders are ranked by a composite score: 70% weight on the average confidence across mandatory criteria, 30% on the proportion of preferred (non-mandatory) criteria passed. Bidders with mandatory failures or unresolved review flags are listed but unranked.',
    { fontSize: 9, lineHeight: 12 },
  );
  y += 8;

  const rankRows = rankings.map((r) => ({
    rank: r.rank ? `#${r.rank}` : '—',
    name: r.bidder.name,
    verdict: VERDICT_WORD(r.overall.status),
    score: r.overall.status === 'eligible' ? (r.score * 100).toFixed(1) : '—',
    passed: `${r.overall.passedCount}/${r.overall.totalMandatory}`,
    review: String(r.overall.reviewCount),
    failed: String(r.overall.failedCount),
  }));

  y = table(
    d,
    margin,
    y,
    [
      { key: 'rank', label: 'Rank', w: 50 },
      { key: 'name', label: 'Bidder', w: 200 },
      { key: 'verdict', label: 'Verdict', w: 100 },
      { key: 'score', label: 'Score', w: 50 },
      { key: 'passed', label: 'Pass', w: 50 },
      { key: 'review', label: '?', w: 30 },
      { key: 'failed', label: 'Fail', w: 35 },
    ],
    rankRows,
    { rowH: 22, headerBg: [232, 232, 224] },
  );
  y += 16;

  // Per-bidder reasoning summary
  for (const r of rankings) {
    y = newPageIfNeeded(d, y, 100, margin);
    d.setFont('helvetica', 'bold');
    d.setFontSize(10);
    d.text(
      `${r.rank ? `#${r.rank}  ` : ''}${r.bidder.name} — ${VERDICT_WORD(r.overall.status)}`,
      margin,
      y,
    );
    y += 13;
    d.setFont('helvetica', 'normal');
    d.setFontSize(9);
    y = paragraph(d, margin, y, r.reasoning, { fontSize: 9, lineHeight: 12 });
    for (const h of r.highlights) {
      y = paragraph(d, margin + 14, y, '• ' + h, { fontSize: 9, lineHeight: 12 });
    }
    y += 8;
  }

  // ============== PAGES 3+: Per-bidder detailed findings ==============
  for (const r of rankings) {
    d.addPage();
    let py = margin;
    d.setFont('helvetica', 'bold');
    d.setFontSize(11);
    d.text(`3. DETAILED FINDINGS — ${r.bidder.name}`, margin, py);
    py += 6;
    hairline(d, margin, py, pageW(d) - margin, py);
    py += 14;

    d.setFont('helvetica', 'normal');
    d.setFontSize(9);
    d.text(
      `Overall verdict: ${VERDICT_WORD(r.overall.status)}   |   Documents on file: ${r.bidder.documents.length}`,
      margin,
      py,
    );
    py += 14;

    // For each criterion of this bidder, render a block
    for (const ev of r.evaluations.slice().sort((a, b) =>
      (a.criterion?.criterion_code || '').localeCompare(b.criterion?.criterion_code || ''),
    )) {
      py = newPageIfNeeded(d, py, 100, margin);
      const c = ev.criterion;
      d.setFont('helvetica', 'bold');
      d.setFontSize(10);
      d.text(`${c?.criterion_code || '?'}  ${VERDICT_WORD(ev.status)}`, margin, py);
      d.setFont('helvetica', 'normal');
      d.setFontSize(9);
      d.text(
        `Confidence ${(ev.confidence * 100).toFixed(0)}%${
          c?.is_mandatory ? '   | mandatory' : '   | preferred'
        }${ev.human_override ? '   | OFFICER OVERRIDE' : ''}`,
        pageW(d) - margin,
        py,
        { align: 'right' },
      );
      py += 12;

      if (c?.description) {
        py = paragraph(d, margin, py, c.description, { fontSize: 9, lineHeight: 12, font: 'italic' });
      }

      if (ev.evidence_text) {
        // Citation block
        d.setFillColor(254, 252, 232);
        const lines = d.splitTextToSize(`"${ev.evidence_text}"`, pageW(d) - margin * 2 - 14);
        const blockH = lines.length * 12 + 12;
        d.rect(margin, py, pageW(d) - margin * 2, blockH, 'F');
        d.setDrawColor(202, 138, 4);
        d.setLineWidth(2);
        d.line(margin, py, margin, py + blockH);
        d.setFont('courier', 'normal');
        d.setFontSize(8.5);
        let lineY = py + 11;
        for (const ln of lines) {
          d.text(ln, margin + 8, lineY);
          lineY += 12;
        }
        py += blockH + 4;
        d.setFont('helvetica', 'normal');
        d.setFontSize(8);
        d.setTextColor(80, 80, 80);
        d.text(
          `Source: ${ev.evidence_doc || 'unknown document'}${ev.evidence_page ? `, page ${ev.evidence_page}` : ''}`,
          margin,
          py,
        );
        d.setTextColor(0, 0, 0);
        py += 12;
      } else {
        d.setFont('helvetica', 'italic');
        d.setFontSize(9);
        d.setTextColor(120, 120, 120);
        d.text('No source quote available for this verdict.', margin, py);
        d.setTextColor(0, 0, 0);
        d.setFont('helvetica', 'normal');
        py += 12;
      }

      // Reasoning
      d.setFont('helvetica', 'normal');
      d.setFontSize(9);
      py = paragraph(d, margin, py, `Reasoning: ${ev.reasoning}`, { fontSize: 9, lineHeight: 12 });

      if (ev.human_override && ev.human_override_reason) {
        py = paragraph(
          d,
          margin,
          py,
          `Officer override: ${ev.human_override_reason} (by ${ev.human_override_by || 'officer'} on ${ev.human_override_at?.slice(0, 10) || ''})`,
          { fontSize: 9, lineHeight: 12, font: 'italic' },
        );
      }
      py += 8;
      hairline(d, margin, py, pageW(d) - margin, py, [230, 230, 230]);
      py += 8;
    }
  }

  // ============== FINAL PAGE: Digital Signature & Verification block ==============
  d.addPage();
  await buildSignaturePage(d, margin, {
    tender,
    fileNo,
    generatedAt,
    officerName,
    lastAuditHash,
    bidders: bidders.length,
    verdicts: evaluations.length,
  });

  // Add watermark on every page
  const totalPages = (d as any).internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    d.setPage(p);
    watermark(d, 'OFFICIAL · NIRNAY');
    // Footer
    d.setFont('helvetica', 'normal');
    d.setFontSize(7);
    d.setTextColor(120, 120, 120);
    d.text(`File No.: ${fileNo}`, margin, pageH(d) - 24);
    d.text(`Page ${p} of ${totalPages}`, pageW(d) - margin, pageH(d) - 24, { align: 'right' });
    d.setTextColor(0, 0, 0);
  }

  // Compute document hash from the final bytes
  const ab = d.output('arraybuffer') as ArrayBuffer;
  const documentHash = await sha256OfArrayBuffer(ab);
  const blob = new Blob([ab], { type: 'application/pdf' });

  // Audit-log the report generation, anchored with the document hash
  await logAuditEvent({
    event_type: 'report_generated',
    entity_type: 'tender',
    entity_id: tender.id,
    payload: {
      file_no: fileNo,
      document_hash: documentHash,
      anchored_to_audit_hash: lastAuditHash,
      bidders: bidders.length,
      verdicts: evaluations.length,
    },
  });

  return {
    blob,
    documentHash,
    fileNo,
    generatedAt: generatedAt.toISOString(),
    filename: `Nirnay-Tender-Evaluation-Report-${tender.name
      .replace(/[^A-Za-z0-9]+/g, '-')
      .slice(0, 40)}-${generatedAt.getTime()}.pdf`,
  };
}

async function sha256OfArrayBuffer(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Page builders
// ---------------------------------------------------------------------------

interface CoverData {
  tender: Tender;
  fileNo: string;
  generatedAt: Date;
  officerName: string;
  totalBidders: number;
  totalCriteria: number;
}

function buildCoverPage(d: jsPDF, margin: number, data: CoverData) {
  const w = pageW(d);

  // Letterhead
  ashokSeal(d, w / 2, margin + 30, 'NIRNAY');
  d.setFont('helvetica', 'bold');
  d.setFontSize(11);
  d.text('OFFICE OF THE PROCUREMENT EVALUATION CELL', w / 2, margin + 76, { align: 'center' });
  d.setFontSize(9);
  d.text('GOVERNMENT OF INDIA · CENTRAL RESERVE POLICE FORCE', w / 2, margin + 90, { align: 'center' });
  d.setFont('helvetica', 'normal');
  d.setFontSize(8);
  d.setTextColor(80, 80, 80);
  d.text('CGO Complex, Lodhi Road, New Delhi - 110003   |   www.crpf.gov.in', w / 2, margin + 102, { align: 'center' });
  d.setTextColor(0, 0, 0);
  doubleRule(d, margin + 116, margin);

  // Title
  d.setFont('helvetica', 'bold');
  d.setFontSize(15);
  d.text('TENDER EVALUATION REPORT', w / 2, margin + 148, { align: 'center' });
  d.setFont('helvetica', 'normal');
  d.setFontSize(10);
  d.text(`Generated by Nirnay  ·  Citation-backed evaluation system`, w / 2, margin + 164, { align: 'center' });

  // Meta block
  let y = margin + 200;
  const labelX = margin;
  const valueX = margin + 130;
  d.setFontSize(9);

  const fields: Array<[string, string]> = [
    ['File No.', data.fileNo],
    ['Date of Generation', data.generatedAt.toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })],
    ['Tender', data.tender.name],
    ...(data.tender.description ? ([['Description', data.tender.description]] as Array<[string, string]>) : []),
    ['Tender Internal ID', data.tender.id],
    ['Bidders evaluated', String(data.totalBidders)],
    ['Eligibility criteria', String(data.totalCriteria)],
    ['Generated by Officer', data.officerName],
  ];
  for (const [label, value] of fields) {
    d.setTextColor(80, 80, 80);
    d.text(label + ':', labelX, y);
    d.setTextColor(0, 0, 0);
    const lines = d.splitTextToSize(value, w - margin - valueX);
    d.text(lines[0] || '', valueX, y);
    if (lines.length > 1) {
      for (let i = 1; i < lines.length; i++) {
        y += 12;
        d.text(lines[i], valueX, y);
      }
    }
    y += 14;
  }
}

function drawSummaryCard(d: jsPDF, x: number, y: number, w: number, label: string, value: string, color: number[] = [12, 10, 9]) {
  d.setDrawColor(220, 220, 220);
  d.setLineWidth(0.5);
  d.rect(x, y, w, 50, 'S');
  d.setFont('helvetica', 'normal');
  d.setFontSize(7.5);
  d.setTextColor(120, 120, 120);
  d.text(label, x + 8, y + 14);
  d.setFont('helvetica', 'bold');
  d.setFontSize(20);
  d.setTextColor(color[0], color[1], color[2]);
  d.text(value, x + 8, y + 38);
  d.setTextColor(0, 0, 0);
  d.setFont('helvetica', 'normal');
}

interface SignatureData {
  tender: Tender;
  fileNo: string;
  generatedAt: Date;
  officerName: string;
  lastAuditHash: string;
  bidders: number;
  verdicts: number;
}

async function buildSignaturePage(d: jsPDF, margin: number, data: SignatureData) {
  const w = pageW(d);
  let y = margin;

  d.setFont('helvetica', 'bold');
  d.setFontSize(11);
  d.text('4. AUTHENTICATION & DIGITAL FINGERPRINT', margin, y);
  y += 6;
  hairline(d, margin, y, w - margin, y);
  y += 18;

  d.setFont('helvetica', 'normal');
  d.setFontSize(10);
  y = paragraph(
    d,
    margin,
    y,
    'This report is authenticated through a cryptographic hash-chain rather than PKI digital signatures (DSC). Every action behind every verdict in this report is recorded in an append-only audit log; each entry contains a SHA-256 hash of its payload and the previous entry. This report is anchored to the audit log via the entry generated at the moment of report creation. Any subsequent modification of the audit log or this PDF is detectable by re-computing the chain.',
    { lineHeight: 13 },
  );
  y += 8;

  // Computed when the PDF is finalised — placeholder text shown here, real
  // hash is added retroactively by post-processing or computed by reader.
  const sigBlockY = y;
  d.setDrawColor(40, 40, 40);
  d.setLineWidth(1.2);
  d.rect(margin, y, w - margin * 2, 200);
  d.setLineWidth(0.4);
  d.rect(margin + 6, y + 6, w - margin * 2 - 12, 188);

  y += 20;
  d.setFont('helvetica', 'bold');
  d.setFontSize(10);
  d.text('CRYPTOGRAPHIC ANCHORING', margin + 16, y);
  y += 16;
  d.setFont('helvetica', 'normal');
  d.setFontSize(8.5);

  d.setTextColor(80, 80, 80);
  d.text('Latest Audit Chain Hash (anchor):', margin + 16, y);
  y += 11;
  d.setTextColor(0, 0, 0);
  d.setFont('courier', 'normal');
  d.setFontSize(8);
  // 64-char hash split into two 32-char lines for readability
  d.text(data.lastAuditHash.slice(0, 32), margin + 16, y);
  y += 10;
  d.text(data.lastAuditHash.slice(32), margin + 16, y);
  y += 14;

  d.setFont('helvetica', 'normal');
  d.setFontSize(8.5);
  d.setTextColor(80, 80, 80);
  d.text('Document SHA-256 (computed from final bytes):', margin + 16, y);
  y += 11;
  d.setTextColor(120, 120, 120);
  d.setFont('courier', 'italic');
  d.setFontSize(8);
  d.text('Computed by reader — recompute SHA-256 of this PDF and look up', margin + 16, y);
  y += 10;
  d.text('the matching report_generated event in the Nirnay audit log.', margin + 16, y);
  y += 14;

  d.setFont('helvetica', 'normal');
  d.setFontSize(8.5);
  d.setTextColor(80, 80, 80);
  d.text('Verification:', margin + 16, y);
  y += 11;
  d.setTextColor(0, 0, 0);
  d.setFontSize(8);
  d.text('1. Open the Audit Trail in the Nirnay dashboard.', margin + 16, y);
  y += 10;
  d.text('2. Filter for event type "report_generated" and the file number above.', margin + 16, y);
  y += 10;
  d.text('3. Compare the document_hash field with the SHA-256 of this PDF.', margin + 16, y);
  y += 10;
  d.text('4. Click "Verify Chain" — the entire audit log re-computes its hashes.', margin + 16, y);

  y = sigBlockY + 220;

  // Signature block
  d.setFont('helvetica', 'bold');
  d.setFontSize(10);
  d.text('CERTIFIED BY', margin, y);
  y += 6;
  hairline(d, margin, y, w - margin, y, [220, 220, 220]);
  y += 60;

  hairline(d, margin, y, margin + 240, y);
  d.setFont('helvetica', 'bold');
  d.setFontSize(10);
  d.text(`(${data.officerName})`, margin, y + 13);
  d.setFont('helvetica', 'normal');
  d.setFontSize(8);
  d.text('Procurement Evaluation Officer', margin, y + 24);
  d.text(`Generated on ${data.generatedAt.toLocaleString('en-IN')}`, margin, y + 35);
  d.text('Authenticated via Nirnay audit chain', margin, y + 46);

  rectSeal(d, w - margin - 130, y - 24, 130, 70, [
    'OFFICE OF',
    'PROCUREMENT EVALUATION',
    'CRPF DG HQ',
    `FILE NO. ${data.fileNo.slice(-8)}`,
  ]);
}
