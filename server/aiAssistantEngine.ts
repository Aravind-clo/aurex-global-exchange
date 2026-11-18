import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AuthUser,
  GeminiEnterpriseAnalysisResult,
  Instrument,
  MlPrediction,
  NewsItem,
  NexusConsensusReport,
  OrderBook,
  Position,
} from '../src/types/market.ts';
import { sanitizePlainText } from './securityFirewall.ts';

export interface AssistantContextPayload {
  user?: AuthUser;
  symbol: string;
  instrument?: Instrument;
  prediction?: MlPrediction;
  orderBook?: OrderBook;
  nexusReport?: NexusConsensusReport | null;
  news: NewsItem[];
  accountMode?: 'demo' | 'real';
  cashBalance: number;
  demoCashBalance?: number;
  realCashBalance?: number;
  vaultBalanceUsd?: number;
  positions: Position[];
  lockdownMode: boolean;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  message: string;
}

function buildDeterministicFallbackReply(ctx: AssistantContextPayload): string {
  const inst = ctx.instrument;
  const pred = ctx.prediction;
  const msgLower = ctx.message.toLowerCase();
  const isBeginner = ctx.user?.experienceMode !== 'pro';
  const accountLabel = ctx.accountMode === 'real' ? 'REAL TRADING ACCOUNT' : 'DEMO PRACTICE ACCOUNT';

  if (
    msgLower.includes('mfa') ||
    msgLower.includes('security') ||
    msgLower.includes('hacker') ||
    msgLower.includes('vault') ||
    msgLower.includes('real-money') ||
    msgLower.includes('real money')
  ) {
    const mfaCount = (ctx.user?.totpEnabled ? 1 : 0) + ((ctx.user?.passkeysCount ?? 0) > 0 ? 1 : 0);
    return [
      `Anti-Hacker Security & Cold Vault Status for ${ctx.user?.name ?? 'your desk'}:`,
      `• Active Account: ${accountLabel} · Trading Cash: $${ctx.cashBalance.toLocaleString()} · Cold Vault Shield: $${(ctx.vaultBalanceUsd ?? 0).toLocaleString()}`,
      `• Dual-MFA Factors: ${mfaCount} / 2 required (TOTP App: ${ctx.user?.totpEnabled ? 'Active' : 'Missing'}, Hardware Passkey: ${(ctx.user?.passkeysCount ?? 0) > 0 ? `${ctx.user?.passkeysCount} bound` : 'Missing'})`,
      `• Emergency Lockdown: ${ctx.lockdownMode ? 'FROZEN (outbound transfers & orders paused)' : 'Armed & WAF Protected'}`,
      `How to stay safe from hackers: Lock idle real profits into your Cold Vault Shield inside Wallet & Vault—locked vault funds cannot be traded or withdrawn without a fresh 6-digit Step-Up 2FA OTP.`,
    ].join('\n');
  }

  if (msgLower.includes('upi') || msgLower.includes('deposit') || msgLower.includes('withdraw') || msgLower.includes('bank')) {
    return [
      `Easy India & Worldwide Deposits / Withdrawals (10 Currencies):`,
      `• Global UPI Corridors: India NPCI (@okicici, @ybl, @oksbi), Singapore PayNow, UAE Aani, France Lyra, Sri Lanka LankaPay, Mauritius MauCAS, Nepal Fonepay & Bhutan DrukPay.`,
      `• Global Banking (USD/INR/EUR/GBP/SGD/AED/JPY/AUD/CAD/CHF): IMPS, NEFT/RTGS, SEPA Instant, US ACH, UK Faster Payments, SWIFT Wire & Card.`,
      `• Safety Rule: Deposit straight into your Real Trading Account OR directly into the Hacker-Proof Cold Vault. Withdrawals require Step-Up 2FA verification.`,
      `Open "Wallet & Vault" from the left sidebar to link your UPI/bank rail in two simple steps.`,
    ].join('\n');
  }

  if (msgLower.includes('portfolio') || msgLower.includes('risk') || msgLower.includes('position') || msgLower.includes('cash') || msgLower.includes('demo')) {
    const totalUnrealized = ctx.positions.reduce((acc, p) => acc + p.unrealizedPnl, 0);
    const totalExposure = ctx.positions.reduce((acc, p) => acc + Math.abs(p.marketValue), 0);
    const posLines =
      ctx.positions.length === 0
        ? '• No open positions right now (100% cash).'
        : ctx.positions
            .slice(0, 5)
            .map(
              (p) =>
                `• ${p.symbol}: ${p.size} units @ avg ${p.avgEntry.toFixed(2)} (Unrealized P&L: ${p.unrealizedPnl >= 0 ? '+' : ''}$${p.unrealizedPnl.toFixed(2)})`
            )
            .join('\n');

    return [
      `Account & Risk Snapshot (${accountLabel}):`,
      `• Demo Balance: $${(ctx.demoCashBalance ?? ctx.cashBalance).toLocaleString()} | Real Balance: $${(ctx.realCashBalance ?? 0).toLocaleString()} | Cold Vault: $${(ctx.vaultBalanceUsd ?? 0).toLocaleString()}`,
      `• Active Position Exposure: $${totalExposure.toLocaleString(undefined, { maximumFractionDigits: 2 })} | Unrealized P&L: ${totalUnrealized >= 0 ? '+' : ''}$${totalUnrealized.toFixed(2)}`,
      posLines,
      isBeginner
        ? 'Beginner tip: Practice your strategy on the Demo Account first, never risk more than 2% per trade, and test your target/stop-loss using the What-If Simulator in Trade.'
        : 'Quant note: Review Support/Resistance & A24 Independent Risk Gate before scaling size.',
    ].join('\n');
  }

  if (!inst || !pred) {
    return `I am your Nuvra High-Reasoning AI Guide (${accountLabel}). Ask about chart predictions, support & resistance targets, live 24-agent scores, Demo vs Real accounts, Global UPI/bank deposits, or protecting funds in Cold Vault.`;
  }

  const nexusLine =
    ctx.nexusReport && ctx.nexusReport.symbol === ctx.symbol
      ? `• 24-Agent Consensus: ${ctx.nexusReport.finalDecision} (Score ${ctx.nexusReport.weightedScore}, Risk Gate: ${ctx.nexusReport.riskGate.verdict})`
      : `• Multi-Agent Signal: Check AI Signals for full 24-agent department breakdown on ${ctx.symbol}.`;

  const topHeadline = ctx.news.find((n) => n.symbols.includes(ctx.symbol)) ?? ctx.news[0];

  return [
    `${inst.name} (${inst.symbol} · ${inst.venue}) AI Chart Prediction (${accountLabel}):`,
    `• Live Price: ${inst.price} (${inst.changePct >= 0 ? '+' : ''}${inst.changePct.toFixed(2)}% 24h) | Support: ${pred.supportLevel.toFixed(2)} | Resistance: ${pred.resistanceLevel.toFixed(2)}`,
    `• Multi-Horizon Forecast: 15m -> ${pred.predictedPrice.toFixed(2)} (${pred.predictedReturnPct >= 0 ? '+' : ''}${pred.predictedReturnPct.toFixed(2)}%) | 1h -> ${pred.predicted1hPrice.toFixed(2)} (${pred.predicted1hReturnPct >= 0 ? '+' : ''}${pred.predicted1hReturnPct.toFixed(2)}%) | 4h -> ${pred.predicted4hPrice.toFixed(2)}`,
    `• AI Suggested Risk Plan: Take-Profit ${pred.suggestedTakeProfit.toFixed(2)} | Stop-Loss ${pred.suggestedStopLoss.toFixed(2)}`,
    `• Why: ${pred.plainSummary}`,
    nexusLine,
    topHeadline ? `• Latest News Catalyst: "${topHeadline.title}" (${topHeadline.sentiment})` : '',
    `Reminder: Predictions estimate probability, never guarantees—always use a Stop-Loss and practice in Demo mode first.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generateAiAssistantResponse(
  ctx: AssistantContextPayload
): Promise<{ reply: string; poweredBy: string }> {
  const cleanQuestion = sanitizePlainText(ctx.message, 800);
  if (!cleanQuestion) {
    return {
      reply: 'Ask me about live chart predictions, support/resistance levels, Demo vs Real trading accounts, UPI/bank deposits, or keeping funds safe in the Cold Vault.',
      poweredBy: 'Quantitative Engine',
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      reply: buildDeterministicFallbackReply({ ...ctx, message: cleanQuestion }),
      poweredBy: 'High-Precision Quant Coach',
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contextBundle = {
      userProfile: ctx.user
        ? {
            name: ctx.user.name,
            experienceMode: ctx.user.experienceMode,
            realMoneyEnabled: ctx.user.realMoneyEnabled,
            totpEnabled: ctx.user.totpEnabled,
            passkeysCount: ctx.user.passkeysCount,
          }
        : undefined,
      accountState: {
        activeMode: ctx.accountMode ?? 'demo',
        activeTradingBalanceUsd: ctx.cashBalance,
        demoBalanceUsd: ctx.demoCashBalance ?? 1_000_000,
        realBalanceUsd: ctx.realCashBalance ?? 0,
        coldVaultBalanceUsd: ctx.vaultBalanceUsd ?? 0,
        lockdownMode: ctx.lockdownMode,
        openPositions: ctx.positions.slice(0, 8),
      },
      activeSymbol: ctx.symbol,
      instrument: ctx.instrument
        ? {
            symbol: ctx.instrument.symbol,
            name: ctx.instrument.name,
            venue: ctx.instrument.venue,
            price: ctx.instrument.price,
            changePct24h: ctx.instrument.changePct,
            spreadBps: ctx.instrument.spreadBps,
            high24h: ctx.instrument.high24h,
            low24h: ctx.instrument.low24h,
          }
        : undefined,
      chartPrediction: ctx.prediction,
      orderBookImbalancePct: ctx.orderBook?.imbalancePct,
      nexusConsensus:
        ctx.nexusReport && ctx.nexusReport.symbol === ctx.symbol
          ? {
              finalDecision: ctx.nexusReport.finalDecision,
              weightedScore: ctx.nexusReport.weightedScore,
              calibratedProbability: ctx.nexusReport.calibratedProbability,
              riskGateVerdict: ctx.nexusReport.riskGate.verdict,
              riskSummary: ctx.nexusReport.riskGate.summary,
            }
          : undefined,
      recentNews: ctx.news.slice(0, 4).map((n) => ({
        title: n.title,
        sentiment: n.sentiment,
        symbols: n.symbols,
      })),
    };

    const historyText = (ctx.history ?? [])
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'Trader' : 'Assistant'}: ${sanitizePlainText(m.content, 500)}`)
      .join('\n');

    const prompt = [
      'LIVE WORKSPACE TELEMETRY (use strictly as factual context):',
      JSON.stringify(contextBundle),
      historyText ? `\nRECENT CONVERSATION:\n${historyText}` : '',
      `\nCURRENT QUESTION:\n${cleanQuestion}`,
    ]
      .filter(Boolean)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        systemInstruction:
          'You are the Nuvra Global Exchange High-Reasoning AI Trading & Security Guide. Help beginners and experienced traders understand chart predictions (15m/1h/4h targets, support/resistance, stop-loss/take-profit), live 24-agent performance scores, safely switch between Demo Practice and Real Trading Accounts, fund via India & International UPI Corridors or Global ACH/SEPA/FPS/SWIFT across 10 currencies, and lock idle funds inside the Hacker-Proof Cold Vault with 2FA. Speak clearly in plain English (under 200 words unless deep breakdown requested), cite live numbers from context, NEVER guarantee profits, and always encourage strict risk management.',
      },
    });

    const text = (response.text ?? '').trim();
    if (!text) {
      return {
        reply: buildDeterministicFallbackReply({ ...ctx, message: cleanQuestion }),
        poweredBy: 'High-Precision Quant Coach',
      };
    }

    return {
      reply: text,
      poweredBy: 'Gemini 4 Hydrogen (High Reasoning)',
    };
  } catch {
    return {
      reply: buildDeterministicFallbackReply({ ...ctx, message: cleanQuestion }),
      poweredBy: 'High-Precision Quant Coach',
    };
  }
}

export class GeminiEnterpriseAnalysisError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function runGeminiEnterpriseAnalysis(params: {
  mode: GeminiEnterpriseAnalysisResult['mode'];
  payload: Record<string, unknown>;
  user?: AuthUser;
}): Promise<GeminiEnterpriseAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiEnterpriseAnalysisError(
      503,
      'Gemini Advanced Analysis Model unavailable: GEMINI_API_KEY is not configured in server environment.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const modePromptMap: Record<GeminiEnterpriseAnalysisResult['mode'], string> = {
    wallet_risk:
      'Analyze multi-chain custody balances, withdrawal allowlist hygiene, 24h velocity caps, and asset exposure risks.',
    threat_triage:
      'Analyze suspicious IP/domain/wallet threat intelligence telemetry, anti-phishing indicators, and card BIN issuer signals.',
    security_remediation:
      'Analyze vibe-security-skill live audit checks, anti-IDOR blocks, HTTP security headers, and provide prioritized code-level remediation steps.',
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [
        `ANALYSIS MODE: ${params.mode}`,
        `OBJECTIVE: ${modePromptMap[params.mode]}`,
        `ACTOR ROLE: ${params.user?.role ?? 'Security Analyst'} (isAdmin=${Boolean(params.user?.isAdmin)})`,
        `TELEMETRY JSON:\n${JSON.stringify(params.payload).slice(0, 12000)}`,
      ].join('\n\n'),
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        systemInstruction:
          'You are the Nuvra Principal Custody Risk & Application Security Architect. Produce strict, concrete, non-fabricated assessments grounded ONLY in the supplied telemetry.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: { type: Type.STRING },
            riskLevel: {
              type: Type.STRING,
              description: 'Must be one of LOW, MODERATE, HIGH, CRITICAL',
            },
            summary: { type: Type.STRING },
            keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['verdict', 'riskLevel', 'summary', 'keyFindings', 'actionPlan'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<GeminiEnterpriseAnalysisResult>;
    const validRisk: GeminiEnterpriseAnalysisResult['riskLevel'] =
      parsed.riskLevel === 'LOW' ||
      parsed.riskLevel === 'MODERATE' ||
      parsed.riskLevel === 'HIGH' ||
      parsed.riskLevel === 'CRITICAL'
        ? parsed.riskLevel
        : 'MODERATE';

    return {
      mode: params.mode,
      model: 'gemini-4-hydrogen (Thinking HIGH)',
      verdict: sanitizePlainText(parsed.verdict || 'Assessment Complete', 140),
      riskLevel: validRisk,
      summary: sanitizePlainText(parsed.summary || 'Enterprise telemetry evaluated cleanly.', 600),
      keyFindings: Array.isArray(parsed.keyFindings)
        ? parsed.keyFindings.slice(0, 8).map((x) => sanitizePlainText(x, 240)).filter(Boolean)
        : [],
      actionPlan: Array.isArray(parsed.actionPlan)
        ? parsed.actionPlan.slice(0, 8).map((x) => sanitizePlainText(x, 240)).filter(Boolean)
        : [],
      generatedAt: Date.now(),
    };
  } catch (err) {
    if (err instanceof GeminiEnterpriseAnalysisError) throw err;
    const msg = err instanceof Error ? err.message : 'Upstream Gemini reasoning request failed.';
    throw new GeminiEnterpriseAnalysisError(502, `Gemini analysis error: ${msg}`);
  }
}

