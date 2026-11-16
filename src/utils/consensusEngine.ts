import type {
  AgentDepartment,
  AgentDirection,
  AgentFinding,
  RiskGateVerdict,
} from '../types/market';

export type MarketVerdictLabel =
  | 'STRONG BUY'
  | 'BUY'
  | 'HOLD'
  | 'SELL'
  | 'STRONG SELL'
  | 'NO TRADE'
  | 'VETOED · NO TRADE';

export interface AgentContribution {
  agent_id: string;
  effectiveWeight: number;
  weightedVote: number;
  votingMass: number;
  sharePct: number;
  included: boolean;
}

export interface DepartmentBreakdown {
  department: AgentDepartment;
  score: number;
  weightSharePct: number;
  agentCount: number;
  direction: AgentDirection;
}

export interface ConflictAgentSide {
  agent_id: string;
  agent_name: string;
  department: AgentDepartment;
  direction: AgentDirection;
  normalized_s: number;
  weight: number;
  evidence: string[];
  invalidations: string[];
}

export interface AgentConflict {
  id: string;
  scope: 'Intra-Department' | 'Cross-Department' | 'Risk Gate Clash';
  severity: 'HIGH' | 'MEDIUM';
  title: string;
  conflictDelta: number;
  explanation: string;
  leftAgent: ConflictAgentSide;
  rightAgent: ConflictAgentSide;
}

export interface WeightedConsensusResult {
  weightedScore: number;
  numerator: number;
  denominator: number;
  rawSignal: AgentDirection;
  marketVerdict: MarketVerdictLabel;
  verdictTone: 'bullish' | 'bearish' | 'neutral' | 'vetoed';
  verdictRationale: string;
  calibratedProbability: number;
  avgConfidence: number;
  avgReliability: number;
  dispersion: number;
  activeAgentCount: number;
  totalAgentCount: number;
  voteCounts: Record<AgentDirection, number>;
  departmentBreakdown: DepartmentBreakdown[];
  contributions: Record<string, AgentContribution>;
  conflicts: AgentConflict[];
  a24Finding?: AgentFinding;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function directionFromConsensusScore(s: number): AgentDirection {
  if (s >= 0.22) return 'BUY';
  if (s <= -0.22) return 'SELL';
  if (Math.abs(s) < 0.06) return 'NO TRADE';
  return 'HOLD';
}

function toConflictSide(f: AgentFinding): ConflictAgentSide {
  return {
    agent_id: f.agent_id,
    agent_name: f.agent_name,
    department: f.department,
    direction: f.direction,
    normalized_s: f.normalized_s,
    weight: f.weight,
    evidence: f.evidence,
    invalidations: f.invalidations,
  };
}

export function detectAgentConflicts(
  findings: AgentFinding[],
  excludedAgentIds: Set<string>,
  riskGate?: RiskGateVerdict,
  rawSignal?: AgentDirection
): AgentConflict[] {
  const active = findings.filter(
    (f) => f.agent_id !== 'A24' && !excludedAgentIds.has(f.agent_id)
  );
  const buys = active
    .filter((f) => f.direction === 'BUY')
    .sort(
      (a, b) =>
        b.normalized_s * b.weight * b.reliability -
        a.normalized_s * a.weight * a.reliability
    );
  const sells = active
    .filter((f) => f.direction === 'SELL')
    .sort(
      (a, b) =>
        Math.abs(b.normalized_s) * b.weight * b.reliability -
        Math.abs(a.normalized_s) * a.weight * a.reliability
    );

  const conflicts: AgentConflict[] = [];
  const usedPairs = new Set<string>();

  // 1. Intra-department contradictions (e.g., A05 Trend Analyst BUY vs A06 Momentum Analyst SELL)
  for (const b of buys) {
    for (const s of sells) {
      if (b.department !== s.department) continue;
      const pairKey = `${b.agent_id}-${s.agent_id}`;
      if (usedPairs.has(pairKey)) continue;
      usedPairs.add(pairKey);
      const delta = Number(Math.abs(b.normalized_s - s.normalized_s).toFixed(2));
      conflicts.push({
        id: `conf-${pairKey}`,
        scope: 'Intra-Department',
        severity: delta >= 0.75 ? 'HIGH' : 'MEDIUM',
        title: `${b.department} Divergence: ${b.agent_id} ${b.agent_name} (BUY) vs ${s.agent_id} ${s.agent_name} (SELL)`,
        conflictDelta: delta,
        explanation: `Both agents operate inside ${b.department} but reach opposite directional conclusions on the same live telemetry.`,
        leftAgent: toConflictSide(b),
        rightAgent: toConflictSide(s),
      });
    }
  }

  // 2. Top cross-department opposing signals (strongest BUY vs strongest SELL across different departments)
  for (const b of buys.slice(0, 3)) {
    for (const s of sells.slice(0, 3)) {
      if (b.department === s.department) continue;
      const pairKey = `${b.agent_id}-${s.agent_id}`;
      if (usedPairs.has(pairKey)) continue;
      const delta = Number(Math.abs(b.normalized_s - s.normalized_s).toFixed(2));
      if (delta < 0.52) continue;
      usedPairs.add(pairKey);
      conflicts.push({
        id: `conf-${pairKey}`,
        scope: 'Cross-Department',
        severity: delta >= 0.9 ? 'HIGH' : 'MEDIUM',
        title: `${b.department} vs ${s.department}: ${b.agent_id} (BUY) opposes ${s.agent_id} (SELL)`,
        conflictDelta: delta,
        explanation: `${b.agent_name} (${b.department}) projects upside while ${s.agent_name} (${s.department}) flags downside risk.`,
        leftAgent: toConflictSide(b),
        rightAgent: toConflictSide(s),
      });
      if (conflicts.length >= 6) break;
    }
    if (conflicts.length >= 6) break;
  }

  // 3. Risk Gate Clash if directional consensus opposes A24 deterministic veto/escalation
  const a24 = findings.find((f) => f.agent_id === 'A24');
  if (
    a24 &&
    riskGate &&
    riskGate.verdict !== 'APPROVE' &&
    (rawSignal === 'BUY' || rawSignal === 'SELL')
  ) {
    const leadResearch = rawSignal === 'BUY' ? buys[0] : sells[0];
    if (leadResearch) {
      conflicts.push({
        id: `conf-a24-${leadResearch.agent_id}`,
        scope: 'Risk Gate Clash',
        severity: riskGate.verdict === 'REJECT' ? 'HIGH' : 'MEDIUM',
        title: `Directional Signal (${rawSignal}) Clashes with A24 Risk Gate (${riskGate.verdict})`,
        conflictDelta: Number(Math.abs(leadResearch.normalized_s).toFixed(2)),
        explanation: riskGate.summary,
        leftAgent: toConflictSide(leadResearch),
        rightAgent: toConflictSide(a24),
      });
    }
  }

  return conflicts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'HIGH' ? -1 : 1;
    return b.conflictDelta - a.conflictDelta;
  });
}

export function computeWeightedConsensus(
  findings: AgentFinding[],
  riskGate?: RiskGateVerdict,
  excludedAgentIds: Set<string> = new Set(),
  deptMultipliers: Partial<Record<AgentDepartment, number>> = {}
): WeightedConsensusResult {
  const voteCounts: Record<AgentDirection, number> = {
    BUY: 0,
    SELL: 0,
    HOLD: 0,
    'NO TRADE': 0,
  };

  let numerator = 0;
  let denominator = 0;
  let confSum = 0;
  let relSum = 0;
  let activeAgentCount = 0;

  const deptMap = new Map<
    AgentDepartment,
    { sum: number; mass: number; count: number }
  >();

  const rawContrib: Array<{
    id: string;
    effectiveWeight: number;
    weightedVote: number;
    votingMass: number;
    included: boolean;
  }> = [];

  let a24Finding: AgentFinding | undefined;

  for (const f of findings) {
    voteCounts[f.direction] = (voteCounts[f.direction] ?? 0) + 1;
    confSum += f.confidence;
    relSum += f.reliability;

    if (f.agent_id === 'A24') {
      a24Finding = f;
    }

    const mult = deptMultipliers[f.department] ?? 1;
    const isExcluded = excludedAgentIds.has(f.agent_id);
    const effectiveWeight = isExcluded ? 0 : Math.max(0, f.weight * mult);
    const votingMass = effectiveWeight * f.reliability;
    const weightedVote = votingMass * f.normalized_s;

    if (votingMass > 0) {
      numerator += weightedVote;
      denominator += votingMass;
      activeAgentCount += 1;
    }

    const prevDept = deptMap.get(f.department) ?? { sum: 0, mass: 0, count: 0 };
    prevDept.sum += weightedVote;
    prevDept.mass += votingMass;
    prevDept.count += 1;
    deptMap.set(f.department, prevDept);

    rawContrib.push({
      id: f.agent_id,
      effectiveWeight: Number(effectiveWeight.toFixed(3)),
      weightedVote: Number(weightedVote.toFixed(4)),
      votingMass: Number(votingMass.toFixed(4)),
      included: !isExcluded,
    });
  }

  const weightedScore =
    denominator > 0 ? Number((numerator / denominator).toFixed(3)) : 0;
  const rawSignal = directionFromConsensusScore(weightedScore);

  const contributions: Record<string, AgentContribution> = {};
  for (const c of rawContrib) {
    contributions[c.id] = {
      agent_id: c.id,
      effectiveWeight: c.effectiveWeight,
      weightedVote: c.weightedVote,
      votingMass: c.votingMass,
      sharePct:
        denominator > 0
          ? Number(((c.votingMass / denominator) * 100).toFixed(1))
          : 0,
      included: c.included,
    };
  }

  const departmentBreakdown: DepartmentBreakdown[] = [];
  for (const [department, stats] of deptMap.entries()) {
    let deptScore =
      stats.mass > 0 ? Number((stats.sum / stats.mass).toFixed(3)) : 0;
    if (department === 'Risk & Governance' && riskGate) {
      deptScore =
        riskGate.verdict === 'APPROVE'
          ? 1
          : riskGate.verdict === 'ESCALATE'
          ? 0
          : -1;
    }
    departmentBreakdown.push({
      department,
      score: deptScore,
      weightSharePct:
        denominator > 0
          ? Number(((stats.mass / denominator) * 100).toFixed(1))
          : 0,
      agentCount: stats.count,
      direction:
        department === 'Risk & Governance'
          ? riskGate?.verdict === 'APPROVE'
            ? rawSignal
            : riskGate?.verdict === 'REJECT'
            ? 'NO TRADE'
            : 'HOLD'
          : directionFromConsensusScore(deptScore),
    });
  }

  const researchDeptScores = departmentBreakdown
    .filter((d) => d.department !== 'Risk & Governance')
    .map((d) => d.score);
  const meanDept =
    researchDeptScores.reduce((a, b) => a + b, 0) /
    Math.max(researchDeptScores.length, 1);
  const dispersion = Number(
    Math.sqrt(
      researchDeptScores.reduce((acc, s) => acc + (s - meanDept) ** 2, 0) /
        Math.max(researchDeptScores.length, 1)
    ).toFixed(3)
  );

  const calibratedProbability = Number(
    clamp(0.5 + Math.abs(weightedScore) * 0.42, 0.5, 0.92).toFixed(2)
  );
  const totalAgentCount = findings.length;
  const avgConfidence =
    totalAgentCount > 0 ? Number((confSum / totalAgentCount).toFixed(2)) : 0;
  const avgReliability =
    totalAgentCount > 0 ? Number((relSum / totalAgentCount).toFixed(2)) : 0;

  let marketVerdict: MarketVerdictLabel;
  let verdictTone: WeightedConsensusResult['verdictTone'];

  if (riskGate?.verdict === 'REJECT') {
    marketVerdict = 'VETOED · NO TRADE';
    verdictTone = 'vetoed';
  } else if (weightedScore >= 0.48) {
    marketVerdict = 'STRONG BUY';
    verdictTone = 'bullish';
  } else if (weightedScore >= 0.22) {
    marketVerdict = 'BUY';
    verdictTone = 'bullish';
  } else if (weightedScore <= -0.48) {
    marketVerdict = 'STRONG SELL';
    verdictTone = 'bearish';
  } else if (weightedScore <= -0.22) {
    marketVerdict = 'SELL';
    verdictTone = 'bearish';
  } else if (Math.abs(weightedScore) < 0.06) {
    marketVerdict = 'NO TRADE';
    verdictTone = 'neutral';
  } else {
    marketVerdict = 'HOLD';
    verdictTone = 'neutral';
  }

  const sortedDepts = departmentBreakdown
    .filter((d) => d.department !== 'Risk & Governance')
    .slice()
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  const leadDept = sortedDepts[0];
  const secondDept = sortedDepts[1];

  let verdictRationale = '';
  if (riskGate?.verdict === 'REJECT') {
    verdictRationale = `Research consensus scored S=${weightedScore >= 0 ? '+' : ''}${weightedScore.toFixed(3)} (${rawSignal}), but Independent Risk Agent A24 vetoed execution: ${riskGate.summary}`;
  } else if (rawSignal === 'BUY' || rawSignal === 'SELL') {
    const drivers = [leadDept, secondDept]
      .filter(Boolean)
      .map(
        (d) =>
          `${d.department} (${d.score >= 0 ? '+' : ''}${d.score.toFixed(2)})`
      )
      .join(' and ');
    verdictRationale = `${activeAgentCount} active voting agents produced S=${weightedScore >= 0 ? '+' : ''}${weightedScore.toFixed(3)}, led by ${drivers}. A24 Risk Gate status: ${riskGate?.verdict ?? 'APPROVE'}.`;
  } else {
    verdictRationale = `Cross-agent conviction is balanced (S=${weightedScore >= 0 ? '+' : ''}${weightedScore.toFixed(3)}, dispersion ${dispersion.toFixed(2)}), keeping the unified Market Verdict at ${marketVerdict} until directional alignment strengthens above ±0.22.`;
  }

  const conflicts = detectAgentConflicts(
    findings,
    excludedAgentIds,
    riskGate,
    rawSignal
  );

  return {
    weightedScore,
    numerator: Number(numerator.toFixed(3)),
    denominator: Number(denominator.toFixed(3)),
    rawSignal,
    marketVerdict,
    verdictTone,
    verdictRationale,
    calibratedProbability,
    avgConfidence,
    avgReliability,
    dispersion,
    activeAgentCount,
    totalAgentCount,
    voteCounts,
    departmentBreakdown,
    contributions,
    conflicts,
    a24Finding,
  };
}
