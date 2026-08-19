import { useEffect, useMemo, useState } from "react";
import {
  ArrowCounterClockwise, CalendarBlank, CaretDown, Check, Crosshair,
  HourglassMedium, Info, Moon, SealCheck, Sun, WarningCircle,
} from "@phosphor-icons/react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BOSSES, createDefaultPlans, createDetailedWeeks, DATA_AS_OF, PASS_END, STAGES, TOTAL_TRACES, TRACE_CAP } from "./data";
import { forecast, traceReward } from "./engine";
import type { BossPlan, CalculatorState, Mode, Theme } from "./types";

const STORAGE_KEY = "genesis-liberation-calculator:v1";
const TODAY = "2026-08-19";

function defaultState(): CalculatorState {
  const plans = createDefaultPlans();
  return {
    version: 1,
    mode: "simple",
    theme: "dark",
    currentStage: 3,
    stageTraces: 240,
    startDate: TODAY,
    genesisPass: true,
    simplePlans: plans,
    detailedWeeks: createDetailedWeeks(plans),
  };
}

function loadState(): CalculatorState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<CalculatorState>;
    if (parsed.version !== 1) return defaultState();
    const fallback = defaultState();
    const normalizePlans = (value: unknown) => {
      const saved = Array.isArray(value) ? value : [];
      return createDefaultPlans().map((plan) => {
        const candidate = saved.find((item) => item && typeof item === "object" && "bossId" in item && item.bossId === plan.bossId) as Partial<BossPlan> | undefined;
        const boss = BOSSES.find((item) => item.id === plan.bossId)!;
        return {
          ...plan,
          difficultyId: boss.difficulties.some((difficulty) => difficulty.id === candidate?.difficultyId) ? candidate!.difficultyId! : plan.difficultyId,
          partySize: Math.max(1, Math.min(6, Number(candidate?.partySize) || 1)),
          enabled: typeof candidate?.enabled === "boolean" ? candidate.enabled : plan.enabled,
          clearedCurrentPeriod: Boolean(candidate?.clearedCurrentPeriod),
        };
      });
    };
    const simplePlans = normalizePlans(parsed.simplePlans);
    const savedWeeks = Array.isArray(parsed.detailedWeeks) ? parsed.detailedWeeks.slice(0, 24) : [];
    return {
      version: 1,
      mode: parsed.mode === "detailed" ? "detailed" : "simple",
      theme: parsed.theme === "light" ? "light" : "dark",
      currentStage: Math.max(0, Math.min(STAGES.length - 1, Number(parsed.currentStage) || 0)),
      stageTraces: Math.max(0, Math.min(TRACE_CAP, Number(parsed.stageTraces) || 0)),
      startDate: typeof parsed.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate) ? parsed.startDate : fallback.startDate,
      genesisPass: typeof parsed.genesisPass === "boolean" ? parsed.genesisPass : fallback.genesisPass,
      simplePlans,
      detailedWeeks: createDetailedWeeks(simplePlans).map((week, index) => ({ ...week, plans: normalizePlans(savedWeeks[index]?.plans) })),
    };
  } catch {
    return defaultState();
  }
}

const number = new Intl.NumberFormat("ko-KR");
const shortDate = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" });
const fullDate = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" className={`toggle ${checked ? "is-on" : ""}`} aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span className="toggle-knob"><Check weight="bold" /></span><span>{label}</span>
    </button>
  );
}

function StageTrack({ state, total }: { state: CalculatorState; total: number }) {
  let threshold = 0;
  return (
    <section className="stage-section game-panel" aria-labelledby="stage-title">
      <div className="section-title" id="stage-title">해방 진행 단계</div>
      <div className="stage-track">
        {STAGES.map((stage, index) => {
          threshold += stage.requirement;
          const isComplete = total >= threshold;
          const isCurrent = index === state.currentStage;
          return (
            <div className={`stage ${isComplete ? "complete" : ""} ${isCurrent ? "current" : ""}`} key={stage.id}>
              <div className="scroll-wrap">
                <img src={`${import.meta.env.BASE_URL}assets/quest-scroll.png`} alt="" />
                <span className="roman">{stage.roman}</span>
                {isComplete && <span className="clear-ribbon">CLEAR</span>}
              </div>
              <span className="stage-name">{stage.name}</span>
              <span className="stage-node" />
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface BossEditorProps {
  plans: BossPlan[];
  passApplied: boolean;
  onChange: (plans: BossPlan[]) => void;
  compact?: boolean;
}

function BossEditor({ plans, passApplied, onChange, compact = false }: BossEditorProps) {
  const patchPlan = (index: number, patch: Partial<BossPlan>) => onChange(plans.map((plan, i) => i === index ? { ...plan, ...patch } : plan));
  return (
    <div className={`boss-editor ${compact ? "compact" : ""}`}>
      <div className="boss-head"><span>보스</span><span>난이도</span><span>파티</span><span>처치</span><span>흔적</span></div>
      {plans.map((plan, index) => {
        const boss = BOSSES.find((item) => item.id === plan.bossId)!;
        return (
          <div className={`boss-row ${plan.enabled ? "enabled" : ""}`} key={plan.bossId}>
            <label className="boss-name"><input type="checkbox" checked={plan.enabled} onChange={(event) => patchPlan(index, { enabled: event.target.checked })} /><span className="boss-mark" /><span>{boss.shortName}</span>{boss.frequency === "monthly" && <em>월간</em>}</label>
            <label className="select-wrap"><select aria-label={`${boss.name} 난이도`} value={plan.difficultyId} disabled={!plan.enabled} onChange={(event) => patchPlan(index, { difficultyId: event.target.value })}>{boss.difficulties.map((difficulty) => <option value={difficulty.id} key={difficulty.id}>{difficulty.label}</option>)}</select><CaretDown /></label>
            <label className="select-wrap party"><select aria-label={`${boss.name} 파티 인원`} value={plan.partySize} disabled={!plan.enabled} onChange={(event) => patchPlan(index, { partySize: Number(event.target.value) })}>{[1,2,3,4,5,6].map((party) => <option value={party} key={party}>{party}인</option>)}</select><CaretDown /></label>
            <label className="clear-check" title="현재 주기에서 이미 처치했다면 선택"><input type="checkbox" checked={plan.clearedCurrentPeriod} disabled={!plan.enabled} onChange={(event) => patchPlan(index, { clearedCurrentPeriod: event.target.checked })} /><span><Check weight="bold" /></span></label>
            <strong>{plan.enabled ? number.format(traceReward(plan, passApplied)) : "—"}</strong>
          </div>
        );
      })}
    </div>
  );
}

function CurrentPanel({ state, setState }: { state: CalculatorState; setState: React.Dispatch<React.SetStateAction<CalculatorState>> }) {
  const stage = STAGES[state.currentStage];
  const requirement = stage?.requirement ?? 1000;
  return (
    <section className="game-panel current-panel">
      <div className="section-title">현재 진행</div>
      <label className="field"><span>현재 퀘스트 단계</span><span className="select-wrap"><select value={state.currentStage} onChange={(event) => setState((prev) => ({ ...prev, currentStage: Number(event.target.value), stageTraces: 0 }))}>{STAGES.map((item, index) => <option value={index} key={item.id}>{index + 1}단계 · {item.name}</option>)}</select><CaretDown /></span></label>
      <label className="field"><span>현재 단계 흔적 <small>보유 상한 {number.format(TRACE_CAP)}</small></span><span className="trace-input"><input type="number" min="0" max={TRACE_CAP} value={state.stageTraces} onChange={(event) => setState((prev) => ({ ...prev, stageTraces: Math.min(TRACE_CAP, Math.max(0, Number(event.target.value) || 0)) }))} /><b>/ {number.format(requirement)}</b></span></label>
      <div className="mini-progress"><span style={{ width: `${Math.min(100, state.stageTraces / requirement * 100)}%` }} /></div>
      <label className="field"><span>계산 시작일</span><input className="date-input" type="date" value={state.startDate} onChange={(event) => setState((prev) => ({ ...prev, startDate: event.target.value }))} /></label>
      <div className="pass-box">
        <span className="pass-emblem"><SealCheck weight="fill" /></span>
        <Toggle checked={state.genesisPass} label={state.genesisPass ? "제네시스 패스 효과 적용 중" : "제네시스 패스 미적용"} onChange={(genesisPass) => setState((prev) => ({ ...prev, genesisPass }))} />
        <small>효과 종료 · 2026. 9. 16.</small>
      </div>
      <p className="hint"><Info weight="fill" />현재 단계의 초과 흔적은 다음 단계로 이어집니다.</p>
    </section>
  );
}

function SummaryPanel({ result }: { result: ReturnType<typeof forecast> }) {
  const chartData = result.weeks.slice(0, 10).map((week) => ({ name: `${week.weekIndex + 1}주`, cumulative: week.cumulative, earned: week.earned }));
  return (
    <section className="game-panel result-panel">
      <div className="section-title">해방 결과</div>
      <div className="result-list">
        <div><CalendarBlank /><span>예상 해방일</span><strong>{result.expectedDate ? fullDate.format(result.expectedDate) : "계산 불가"}</strong></div>
        <div><HourglassMedium /><span>남은 기간</span><strong>{result.weeksRemaining ? `${result.weeksRemaining}주` : "—"}</strong></div>
        <div><Crosshair /><span>다음 목표</span><strong>{result.nextStageName}</strong></div>
      </div>
      <div className="chart-title"><span>주차별 해방 계획</span><small>평균 주간 획득 <b>{number.format(result.weeklyAverage)}</b></small></div>
      <div className="chart-wrap" aria-label="주차별 누적 흔적 차트">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, TOTAL_TRACES]} tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "var(--panel-strong)", border: "1px solid var(--line)", borderRadius: 4 }} formatter={(value) => number.format(Number(value))} />
            <ReferenceLine y={TOTAL_TRACES} stroke="#e4bd3e" strokeDasharray="8 5" />
            <Bar dataKey="cumulative" fill="var(--violet)" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {result.warnings.map((warning) => <p className="warning" key={warning}><WarningCircle weight="fill" />{warning}</p>)}
    </section>
  );
}

function DetailedMode({ state, setState, result }: { state: CalculatorState; setState: React.Dispatch<React.SetStateAction<CalculatorState>>; result: ReturnType<typeof forecast> }) {
  const [selectedWeek, setSelectedWeek] = useState(0);
  const week = state.detailedWeeks[selectedWeek];
  const weekResult = result.weeks[selectedWeek];
  const setPlans = (plans: BossPlan[]) => setState((prev) => ({ ...prev, detailedWeeks: prev.detailedWeeks.map((item, index) => index === selectedWeek ? { ...item, plans } : item) }));
  return (
    <div className="detailed-layout">
      <CurrentPanel state={state} setState={setState} />
      <section className="game-panel week-list-panel">
        <div className="section-title">주차별 계획</div>
        <div className="week-list">
          {state.detailedWeeks.slice(0, 12).map((item, index) => {
            const row = result.weeks[index];
            return <button type="button" className={selectedWeek === index ? "active" : ""} key={item.weekIndex} onClick={() => setSelectedWeek(index)}><span>{index + 1}주차</span><small>{row ? `${shortDate.format(row.start)}–${shortDate.format(row.end)}` : "계획 없음"}</small><b>{number.format(row?.earned ?? 0)}</b></button>;
          })}
        </div>
      </section>
      <section className="game-panel detail-editor-panel">
        <div className="section-title">{selectedWeek + 1}주차 상세 설정 <small>{weekResult && `${shortDate.format(weekResult.start)} – ${shortDate.format(weekResult.end)}`}</small></div>
        <BossEditor plans={week?.plans ?? []} passApplied={weekResult?.passApplied ?? state.genesisPass} onChange={setPlans} compact />
      </section>
      <section className="game-panel week-summary-panel">
        <div className="section-title">선택 주차 결과</div>
        <div className="week-metric"><span>획득 예상</span><strong>{number.format(weekResult?.earned ?? 0)}</strong><small>흔적</small></div>
        <div className="week-metric"><span>누적 예상</span><strong>{number.format(weekResult?.cumulative ?? result.currentTotal)}</strong><small>/ 6,500</small></div>
        <ul>{weekResult?.bosses.map((boss) => <li key={`${boss.name}-${boss.difficulty}`}><span>{boss.name} · {boss.difficulty} · {boss.partySize}인</span><b>+{boss.traces}</b></li>)}</ul>
        {weekResult?.passApplied && <p className="pass-note"><SealCheck weight="fill" />패스 3배 적용 주차</p>}
      </section>
    </div>
  );
}

export function App() {
  const [state, setState] = useState<CalculatorState>(loadState);
  const result = useMemo(() => forecast(state), [state]);
  const noPassResult = useMemo(() => forecast({ ...state, genesisPass: false }), [state]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { document.documentElement.dataset.theme = state.theme; }, [state.theme]);

  const setMode = (mode: Mode) => setState((prev) => ({ ...prev, mode }));
  const setTheme = (theme: Theme) => setState((prev) => ({ ...prev, theme }));
  const reset = () => { if (window.confirm("저장된 진행 상황과 보스 계획을 초기화할까요?")) setState(defaultState()); };

  return (
    <main className="app-shell">
      <div className="game-window">
        <header className="window-titlebar"><strong>GENESIS LIBERATION</strong><div className="window-actions"><button type="button" aria-label="라이트 모드" className={state.theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun /></button><button type="button" aria-label="다크 모드" className={state.theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon /></button></div></header>
        <div className="hero-title"><span /> <h1>제네시스 해방 계산기</h1> <span /></div>
        <nav className="mode-tabs" aria-label="계산 모드">
          <button type="button" className={state.mode === "simple" ? "active" : ""} onClick={() => setMode("simple")}><b>간단 모드</b><small>매주 같은 보스 기준</small></button>
          <button type="button" className={state.mode === "detailed" ? "active" : ""} onClick={() => setMode("detailed")}><b>상세 모드</b><small>주차별 보스 직접 설정</small></button>
          <p>{state.mode === "simple" ? "반복 가능한 보스 계획으로 빠르게 계산합니다." : "매주 달라지는 난이도와 파티 구성을 직접 조정합니다."}</p>
        </nav>
        <StageTrack state={state} total={result.currentTotal} />

        {state.mode === "simple" ? (
          <div className="simple-layout">
            <CurrentPanel state={state} setState={setState} />
            <section className="game-panel boss-panel"><div className="section-title">보스 설정 <small>매주 반복</small></div><BossEditor plans={state.simplePlans} passApplied={state.genesisPass && new Date(state.startDate) <= new Date(PASS_END)} onChange={(simplePlans) => setState((prev) => ({ ...prev, simplePlans }))} /></section>
            <SummaryPanel result={result} />
          </div>
        ) : <DetailedMode state={state} setState={setState} result={result} />}

        <footer className="window-footer">
          <button type="button" className="reset-button" onClick={reset}><ArrowCounterClockwise weight="bold" />설정 초기화</button>
          <div className="compare"><span>패스 사용</span><b>{result.weeksRemaining ?? "—"}주</b><i>vs</i><span>미사용</span><b>{noPassResult.weeksRemaining ?? "—"}주</b></div>
          <p>데이터 기준 {DATA_AS_OF} · 입력은 이 브라우저에 자동 저장됩니다.</p>
        </footer>
      </div>
      <aside className="disclaimer">메이플스토리 공식 서비스가 아닌 팬 제작 계산기입니다. 실제 일정은 보스 클리어와 점검 일정에 따라 달라질 수 있습니다. <a href="https://maplestory.nexon.com/news/update/762" target="_blank" rel="noreferrer">공식 해방 규칙</a> · <a href="https://maplestory.nexon.com/news/update/805" target="_blank" rel="noreferrer">제네시스 패스</a> · 이 페이지에는 메이플스토리가 제공한 메이플스토리 서체가 적용되어 있습니다.</aside>
    </main>
  );
}
