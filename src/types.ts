export type Theme = "dark" | "light";
export type Mode = "simple" | "detailed";
export type BossFrequency = "weekly" | "monthly";

export interface Difficulty { id: string; label: string; traces: number }
export interface BossDefinition { id: string; name: string; shortName: string; frequency: BossFrequency; difficulties: Difficulty[] }
export interface BossPlan { bossId: string; difficultyId: string; partySize: number; enabled: boolean; clearedCurrentPeriod: boolean }
export interface WeekOverride { weekIndex: number; plans: BossPlan[] }

export interface CalculatorState {
  version: 1;
  mode: Mode;
  theme: Theme;
  currentStage: number;
  stageTraces: number;
  startDate: string;
  genesisPass: boolean;
  simplePlans: BossPlan[];
  detailedWeeks: WeekOverride[];
}

export interface WeekResult {
  weekIndex: number;
  start: Date;
  end: Date;
  earned: number;
  cumulative: number;
  bosses: { name: string; difficulty: string; partySize: number; traces: number }[];
  passApplied: boolean;
  completedStageIndexes: number[];
}

export interface ForecastResult {
  currentTotal: number;
  remaining: number;
  weeklyAverage: number;
  expectedDate: Date | null;
  weeksRemaining: number | null;
  nextStageName: string;
  weeks: WeekResult[];
  warnings: string[];
}
