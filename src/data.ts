import type { BossDefinition, BossPlan } from "./types";

export const DATA_AS_OF = "2026-08-19";
export const PASS_END = "2026-09-16T23:59:59+09:00";
export const TOTAL_TRACES = 6500;
export const TRACE_CAP = 1500;

export const STAGES = [
  { id: "von-leon", name: "반 레온", requirement: 500, roman: "I" },
  { id: "arkarium", name: "아카이럼", requirement: 500, roman: "II" },
  { id: "magnus", name: "매그너스", requirement: 500, roman: "III" },
  { id: "lotus", name: "스우", requirement: 1000, roman: "IV" },
  { id: "damien", name: "데미안", requirement: 1000, roman: "V" },
  { id: "will", name: "윌", requirement: 1000, roman: "VI" },
  { id: "lucid", name: "루시드", requirement: 1000, roman: "VII" },
  { id: "hilla", name: "진 힐라", requirement: 1000, roman: "VIII" },
] as const;

export const BOSSES: BossDefinition[] = [
  { id: "lotus", name: "스우", shortName: "스우", frequency: "weekly", difficulties: [
    { id: "normal", label: "노멀", traces: 10 }, { id: "hard", label: "하드", traces: 50 }, { id: "extreme", label: "익스트림", traces: 50 },
  ] },
  { id: "damien", name: "데미안", shortName: "데미안", frequency: "weekly", difficulties: [
    { id: "normal", label: "노멀", traces: 10 }, { id: "hard", label: "하드", traces: 50 },
  ] },
  { id: "lucid", name: "루시드", shortName: "루시드", frequency: "weekly", difficulties: [
    { id: "easy", label: "이지", traces: 15 }, { id: "normal", label: "노멀", traces: 20 }, { id: "hard", label: "하드", traces: 65 },
  ] },
  { id: "dusk", name: "더스크", shortName: "더스크", frequency: "weekly", difficulties: [
    { id: "normal", label: "노멀", traces: 20 }, { id: "chaos", label: "카오스", traces: 65 },
  ] },
  { id: "will", name: "윌", shortName: "윌", frequency: "weekly", difficulties: [
    { id: "easy", label: "이지", traces: 15 }, { id: "normal", label: "노멀", traces: 25 }, { id: "hard", label: "하드", traces: 75 },
  ] },
  { id: "gloom", name: "듄켈", shortName: "듄켈", frequency: "weekly", difficulties: [
    { id: "normal", label: "노멀", traces: 25 }, { id: "hard", label: "하드", traces: 75 },
  ] },
  { id: "hilla", name: "진 힐라", shortName: "진 힐라", frequency: "weekly", difficulties: [
    { id: "normal", label: "노멀", traces: 45 }, { id: "hard", label: "하드", traces: 90 },
  ] },
  { id: "black-mage", name: "검은 마법사", shortName: "검마", frequency: "monthly", difficulties: [
    { id: "hard", label: "하드", traces: 600 }, { id: "extreme", label: "익스트림", traces: 600 },
  ] },
];

export const createDefaultPlans = (): BossPlan[] => BOSSES.map((boss) => ({
  bossId: boss.id,
  difficultyId: boss.difficulties[boss.difficulties.length - 1].id,
  partySize: 1,
  enabled: boss.id !== "black-mage",
  clearedCurrentPeriod: false,
}));

export const createDetailedWeeks = (plans: BossPlan[], count = 16) => Array.from({ length: count }, (_, weekIndex) => ({
  weekIndex,
  plans: plans.map((plan) => ({ ...plan, clearedCurrentPeriod: false })),
}));
