import { describe, expect, it } from "vitest";
import { BOSSES, createDefaultPlans, createDetailedWeeks, STAGES, TOTAL_TRACES } from "./data";
import { currentTotal, forecast, traceReward, weekStartFor } from "./engine";
import type { CalculatorState } from "./types";

function state(patch: Partial<CalculatorState> = {}): CalculatorState {
  const plans = createDefaultPlans();
  return {
    version: 1,
    mode: "simple",
    theme: "dark",
    currentStage: 0,
    stageTraces: 0,
    startDate: "2026-08-19",
    genesisPass: true,
    simplePlans: plans,
    detailedWeeks: createDetailedWeeks(plans),
    ...patch,
  };
}

describe("고정 데이터", () => {
  it("단계별 요구량의 합은 6,500이다", () => {
    expect(STAGES.map((item) => item.requirement)).toEqual([500, 500, 500, 1000, 1000, 1000, 1000, 1000]);
    expect(STAGES.reduce((sum, item) => sum + item.requirement, 0)).toBe(TOTAL_TRACES);
  });

  it("모든 난이도별 획득량이 기준값과 일치한다", () => {
    expect(BOSSES.map((boss) => [boss.id, boss.difficulties.map((difficulty) => difficulty.traces)])).toEqual([
      ["lotus", [10, 50, 50]], ["damien", [10, 50]], ["lucid", [15, 20, 65]], ["dusk", [20, 65]],
      ["will", [15, 25, 75]], ["gloom", [25, 75]], ["hilla", [45, 90]], ["black-mage", [600, 600]],
    ]);
  });
});

describe("흔적 계산", () => {
  it("파티 인원으로 나눈 뒤 내림하고 패스 3배를 적용한다", () => {
    const plan = { bossId: "will", difficultyId: "hard", partySize: 2, enabled: true, clearedCurrentPeriod: false };
    expect(traceReward(plan, false)).toBe(37);
    expect(traceReward(plan, true)).toBe(111);
    expect(traceReward({ ...plan, partySize: 6 }, false)).toBe(12);
  });

  it("초과 흔적은 다음 단계로 이월되며 보유량은 1,500으로 제한된다", () => {
    expect(currentTotal(0, 700)).toBe(700);
    expect(currentTotal(1, 1500)).toBe(2000);
    expect(currentTotal(1, 9999)).toBe(2000);
  });

  it("패스 솔로 최고 구성은 주간 1,410, 검은 마법사 1회 1,800이다", () => {
    const plans = createDefaultPlans();
    const weekly = plans.filter((plan) => plan.bossId !== "black-mage").reduce((sum, plan) => sum + traceReward(plan, true), 0);
    const blackMage = { ...plans.find((plan) => plan.bossId === "black-mage")!, enabled: true };
    expect(weekly).toBe(1410);
    expect(traceReward(blackMage, true)).toBe(1800);
  });
});

describe("일정 시뮬레이션", () => {
  it("목요일을 주간 시작으로 계산한다", () => {
    expect(weekStartFor("2026-08-19").toISOString()).toBe("2026-08-12T15:00:00.000Z");
    expect(weekStartFor("2026-08-20").toISOString()).toBe("2026-08-19T15:00:00.000Z");
  });

  it("이번 주 이미 처치한 보스는 첫 주에 중복 획득하지 않는다", () => {
    const plans = createDefaultPlans().map((plan) => ({ ...plan, clearedCurrentPeriod: true }));
    const result = forecast(state({ simplePlans: plans }), 2);
    expect(result.weeks[0].earned).toBe(0);
    expect(result.weeks[1].earned).toBe(1410);
  });

  it("패스 종료 뒤 주차는 일반 획득량으로 전환한다", () => {
    const result = forecast(state({ startDate: "2026-09-03" }), 3);
    expect(result.weeks[0].passApplied).toBe(true);
    expect(result.weeks[1].passApplied).toBe(true);
    expect(result.weeks[2].passApplied).toBe(false);
    expect(result.weeks[2].earned).toBe(470);
  });

  it("검은 마법사는 월별 한 번만 포함한다", () => {
    const plans = createDefaultPlans().map((plan) => plan.bossId === "black-mage" ? { ...plan, enabled: true } : { ...plan, enabled: false });
    const result = forecast(state({ startDate: "2026-08-20", genesisPass: false, simplePlans: plans }), 4);
    expect(result.weeks.map((week) => week.earned)).toEqual([600, 0, 600, 0]);
  });
});
