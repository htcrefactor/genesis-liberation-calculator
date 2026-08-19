import { BOSSES, PASS_END, STAGES, TOTAL_TRACES, TRACE_CAP } from "./data";
import type { BossPlan, CalculatorState, ForecastResult, WeekResult } from "./types";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function currentTotal(stageIndex: number, stageTraces: number) {
  const completed = STAGES.slice(0, Math.max(0, stageIndex)).reduce((sum, stage) => sum + stage.requirement, 0);
  return Math.min(TOTAL_TRACES, completed + Math.min(Math.max(0, stageTraces), TRACE_CAP));
}

export function traceReward(plan: BossPlan, passApplied: boolean) {
  if (!plan.enabled) return 0;
  const boss = BOSSES.find((item) => item.id === plan.bossId);
  const difficulty = boss?.difficulties.find((item) => item.id === plan.difficultyId);
  if (!difficulty) return 0;
  return Math.floor(difficulty.traces / Math.max(1, Math.min(6, plan.partySize))) * (passApplied ? 3 : 1);
}

export function weekStartFor(dateInput: string | Date) {
  const date = typeof dateInput === "string" ? new Date(`${dateInput}T12:00:00+09:00`) : new Date(dateInput);
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const daysSinceThursday = (kst.getUTCDay() + 3) % 7;
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - daysSinceThursday) - KST_OFFSET_MS);
}

function monthKey(date: Date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return `${kst.getUTCFullYear()}-${kst.getUTCMonth() + 1}`;
}

function plansForWeek(state: CalculatorState, weekIndex: number) {
  return state.mode === "detailed" ? state.detailedWeeks[weekIndex]?.plans ?? [] : state.simplePlans;
}

function crossedStages(before: number, after: number) {
  let sum = 0;
  return STAGES.flatMap((stage, index) => {
    sum += stage.requirement;
    return before < sum && after >= sum ? [index] : [];
  });
}

export function forecast(state: CalculatorState, maxWeeks = 52): ForecastResult {
  const startTotal = currentTotal(state.currentStage, state.stageTraces);
  const start = weekStartFor(state.startDate);
  const currentMonth = monthKey(new Date(`${state.startDate}T12:00:00+09:00`));
  const monthlyUsed = new Set<string>();
  const currentBlackMage = state.simplePlans.find((plan) => plan.bossId === "black-mage");
  if (currentBlackMage?.clearedCurrentPeriod) monthlyUsed.add(currentMonth);
  let cumulative = startTotal;
  const weeks: WeekResult[] = [];

  for (let weekIndex = 0; weekIndex < maxWeeks && cumulative < TOTAL_TRACES; weekIndex += 1) {
    const weekStart = new Date(start.getTime() + weekIndex * 7 * DAY_MS);
    const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);
    const passApplied = state.genesisPass && weekStart.getTime() <= new Date(PASS_END).getTime();
    const bossRows: WeekResult["bosses"] = [];

    for (const plan of plansForWeek(state, weekIndex)) {
      const boss = BOSSES.find((item) => item.id === plan.bossId);
      const difficulty = boss?.difficulties.find((item) => item.id === plan.difficultyId);
      if (!boss || !difficulty || !plan.enabled) continue;
      if (weekIndex === 0 && plan.clearedCurrentPeriod) {
        if (boss.frequency === "monthly") monthlyUsed.add(monthKey(weekStart));
        continue;
      }
      if (boss.frequency === "monthly") {
        const key = monthKey(weekStart);
        if (monthlyUsed.has(key)) continue;
        monthlyUsed.add(key);
      }
      const traces = traceReward(plan, passApplied);
      bossRows.push({ name: boss.name, difficulty: difficulty.label, partySize: plan.partySize, traces });
    }

    const earned = bossRows.reduce((sum, row) => sum + row.traces, 0);
    const before = cumulative;
    cumulative = Math.min(TOTAL_TRACES, cumulative + earned);
    weeks.push({ weekIndex, start: weekStart, end: weekEnd, earned, cumulative, bosses: bossRows, passApplied, completedStageIndexes: crossedStages(before, cumulative) });
    if (earned === 0 && weekIndex >= 4) break;
  }

  const completion = weeks.find((week) => week.cumulative >= TOTAL_TRACES);
  const earningWeeks = weeks.filter((week) => week.earned > 0);
  const average = earningWeeks.length ? Math.round(earningWeeks.reduce((sum, week) => sum + week.earned, 0) / earningWeeks.length) : 0;
  const warnings: string[] = [];
  if (!completion) warnings.push("현재 계획으로는 1년 안에 필요한 흔적을 모두 모을 수 없습니다.");
  if (state.genesisPass && completion && completion.start > new Date(PASS_END)) warnings.push("제네시스 패스 종료 후에는 일반 획득량으로 계산됩니다.");
  const hasBlackMage = state.mode === "simple"
    ? state.simplePlans.some((plan) => plan.bossId === "black-mage" && plan.enabled)
    : state.detailedWeeks.some((week) => week.plans.some((plan) => plan.bossId === "black-mage" && plan.enabled));
  if (!hasBlackMage) warnings.push("검은 마법사를 계획에 추가하면 해방 시점을 크게 앞당길 수 있습니다.");

  const nextStageIndex = STAGES.findIndex((_, index) => {
    const threshold = STAGES.slice(0, index + 1).reduce((sum, stage) => sum + stage.requirement, 0);
    return startTotal < threshold;
  });

  return {
    currentTotal: startTotal,
    remaining: Math.max(0, TOTAL_TRACES - startTotal),
    weeklyAverage: average,
    expectedDate: completion?.start ?? null,
    weeksRemaining: completion ? completion.weekIndex + 1 : null,
    nextStageName: nextStageIndex >= 0 ? STAGES[nextStageIndex].name : "해방 완료",
    weeks,
    warnings,
  };
}
