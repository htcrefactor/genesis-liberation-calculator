import { useEffect, useMemo, useState } from "react";
import { ArrowCounterClockwise, CaretDown, Check, DownloadSimple, Info, Moon, SealCheck, Sun, WarningCircle } from "@phosphor-icons/react";
import { BOSSES, createDefaultPlans, createDetailedWeeks, DATA_AS_OF, STAGES, TOTAL_TRACES, TRACE_CAP } from "./data";
import { forecast, traceReward } from "./engine";
import type { BossPlan, CalculatorState, Theme } from "./types";

const STORAGE_KEY = "genesis-liberation-calculator:v1";
const TODAY = "2026-08-19";
const number = new Intl.NumberFormat("ko-KR");
const fullDate = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });
const rangeDate = new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" });

function defaultState(): CalculatorState {
  const plans = createDefaultPlans();
  return { version: 1, mode: "detailed", theme: "dark", currentStage: 3, stageTraces: 240, startDate: TODAY, genesisPass: true, simplePlans: plans, detailedWeeks: createDetailedWeeks(plans) };
}

function normalizePlans(value: unknown): BossPlan[] {
  const saved = Array.isArray(value) ? value : [];
  return createDefaultPlans().map((plan) => {
    const candidate = saved.find((item) => item && typeof item === "object" && "bossId" in item && item.bossId === plan.bossId) as Partial<BossPlan> | undefined;
    const boss = BOSSES.find((item) => item.id === plan.bossId)!;
    return { ...plan, difficultyId: boss.difficulties.some((difficulty) => difficulty.id === candidate?.difficultyId) ? candidate!.difficultyId! : plan.difficultyId, partySize: Math.max(1, Math.min(6, Number(candidate?.partySize) || 1)), enabled: typeof candidate?.enabled === "boolean" ? candidate.enabled : plan.enabled, clearedCurrentPeriod: Boolean(candidate?.clearedCurrentPeriod) };
  });
}

function loadState(): CalculatorState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<CalculatorState>;
    if (parsed.version !== 1) return defaultState();
    const fallback = defaultState();
    const simplePlans = normalizePlans(parsed.simplePlans);
    const savedWeeks = Array.isArray(parsed.detailedWeeks) ? parsed.detailedWeeks.slice(0, 24) : [];
    return { version: 1, mode: "detailed", theme: parsed.theme === "light" ? "light" : "dark", currentStage: Math.max(0, Math.min(STAGES.length - 1, Number(parsed.currentStage) || 0)), stageTraces: Math.max(0, Math.min(TRACE_CAP, Number(parsed.stageTraces) || 0)), startDate: typeof parsed.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate) ? parsed.startDate : fallback.startDate, genesisPass: typeof parsed.genesisPass === "boolean" ? parsed.genesisPass : fallback.genesisPass, simplePlans, detailedWeeks: createDetailedWeeks(simplePlans).map((week, index) => ({ ...week, plans: normalizePlans(savedWeeks[index]?.plans) })) };
  } catch { return defaultState(); }
}

function SelectShell({ children }: { children: React.ReactNode }) { return <span className="select-shell">{children}<CaretDown weight="bold" /></span>; }

function BossList({ plans, passApplied, onChange }: { plans: BossPlan[]; passApplied: boolean; onChange: (plans: BossPlan[]) => void }) {
  const patch = (index: number, change: Partial<BossPlan>) => onChange(plans.map((plan, i) => i === index ? { ...plan, ...change } : plan));
  return <div className="boss-list">{plans.map((plan, index) => {
    const boss = BOSSES.find((item) => item.id === plan.bossId)!;
    return <article className={`boss-card ${plan.enabled ? "selected" : ""}`} key={boss.id}>
      <label className="boss-toggle"><input type="checkbox" checked={plan.enabled} onChange={(event) => patch(index, { enabled: event.target.checked })} /><span className="check-box"><Check weight="bold" /></span><span className="boss-sigil"><SealCheck weight="fill" /></span><span className="boss-copy"><b>{boss.name}</b><small>{boss.frequency === "monthly" ? "월간 보스" : "주간 보스"}</small></span></label>
      <div className="boss-controls"><SelectShell><select aria-label={`${boss.name} 난이도`} disabled={!plan.enabled} value={plan.difficultyId} onChange={(event) => patch(index, { difficultyId: event.target.value })}>{boss.difficulties.map((difficulty) => <option key={difficulty.id} value={difficulty.id}>{difficulty.label}</option>)}</select></SelectShell><SelectShell><select aria-label={`${boss.name} 파티 인원`} disabled={!plan.enabled} value={plan.partySize} onChange={(event) => patch(index, { partySize: Number(event.target.value) })}>{[1,2,3,4,5,6].map((party) => <option key={party} value={party}>{party}인</option>)}</select></SelectShell><label className="period-clear"><input type="checkbox" checked={plan.clearedCurrentPeriod} disabled={!plan.enabled} onChange={(event) => patch(index, { clearedCurrentPeriod: event.target.checked })} /><span>처치 완료</span></label><strong>+{number.format(traceReward(plan, passApplied))}</strong></div>
    </article>;
  })}</div>;
}

function StageTrack({ currentTotal }: { currentTotal: number }) {
  let threshold = 0;
  return <section className="tool-panel stage-panel"><h2>해방 진행 단계</h2><div className="stage-grid">{STAGES.map((stage) => {
    threshold += stage.requirement;
    const complete = currentTotal >= threshold;
    const active = !complete && currentTotal >= threshold - stage.requirement;
    return <article className={`${complete ? "complete" : ""} ${active ? "active" : ""}`} key={stage.id}><span className="roman">{stage.roman}</span><b>{stage.name}</b><small>{complete ? "완료" : active ? "진행 중" : "잠김"}</small></article>;
  })}</div></section>;
}

export function App() {
  const [state, setState] = useState<CalculatorState>(loadState);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const result = useMemo(() => forecast({ ...state, mode: "detailed" }), [state]);
  const week = state.detailedWeeks[selectedWeek];
  const weekResult = result.weeks[selectedWeek];
  const requirement = STAGES[state.currentStage]?.requirement ?? 1000;
  const updateWeekPlans = (plans: BossPlan[]) => setState((prev) => ({ ...prev, detailedWeeks: prev.detailedWeeks.map((item, index) => index === selectedWeek ? { ...item, plans } : item) }));

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { document.documentElement.dataset.theme = state.theme; }, [state.theme]);

  const reset = () => { if (window.confirm("저장된 진행 상황과 주차별 계획을 초기화할까요?")) { setState(defaultState()); setSelectedWeek(0); } };
  const setTheme = (theme: Theme) => setState((prev) => ({ ...prev, theme }));

  return <main className="app-shell"><div className="tool-window">
    <header className="tool-titlebar"><strong>LIBERATION STATUS</strong><div><button type="button" aria-label="라이트 모드" className={state.theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun /></button><button type="button" aria-label="다크 모드" className={state.theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon /></button></div></header>
    <div className="workspace"><aside className="control-column">
      <nav className="tool-tabs" aria-label="해방 계산 설정"><button className="active" type="button">진척</button><button type="button" onClick={() => document.getElementById("boss-settings")?.scrollIntoView({ behavior: "smooth" })}>보스</button><button type="button" onClick={() => document.getElementById("pass-settings")?.scrollIntoView({ behavior: "smooth" })}>패스</button></nav>
      <section className="tool-panel settings-panel"><h2>계산 설정</h2>
        <label><span>현재 퀘스트</span><SelectShell><select value={state.currentStage} onChange={(event) => setState((prev) => ({ ...prev, currentStage: Number(event.target.value), stageTraces: 0 }))}>{STAGES.map((item, index) => <option key={item.id} value={index}>{index + 1}단계 · {item.name}</option>)}</select></SelectShell></label>
        <label><span>보유 흔적</span><span className="number-field"><input type="number" min="0" max={TRACE_CAP} value={state.stageTraces} onChange={(event) => setState((prev) => ({ ...prev, stageTraces: Math.max(0, Math.min(TRACE_CAP, Number(event.target.value) || 0)) }))} /><b>/ {number.format(requirement)}</b></span></label>
        <label><span>계산 시작일</span><input className="date-field" type="date" value={state.startDate} onChange={(event) => setState((prev) => ({ ...prev, startDate: event.target.value }))} /></label>
        <div className="pass-control" id="pass-settings"><span className="boss-sigil"><SealCheck weight="fill" /></span><button type="button" aria-pressed={state.genesisPass} onClick={() => setState((prev) => ({ ...prev, genesisPass: !prev.genesisPass }))}>{state.genesisPass ? "제네시스 패스 적용" : "제네시스 패스 미적용"}</button><small>효과 종료 2026. 9. 16.</small></div>
      </section>
      <section className="tool-panel boss-panel" id="boss-settings"><h2>보스 계획 <small>{selectedWeek + 1}주차</small></h2><BossList plans={week?.plans ?? []} passApplied={Boolean(weekResult?.passApplied ?? state.genesisPass)} onChange={updateWeekPlans} /></section>
      <section className="tool-panel trace-card"><h2>현재 어둠의 흔적 보유량</h2><div><span className="trace-orb" /><strong>{number.format(result.currentTotal)}</strong><small>이번 주 획득 예상 <b>{number.format(weekResult?.earned ?? 0)}</b></small></div></section>
    </aside>
    <section className="content-column">
      <section className="quest-hero"><div className="hero-copy"><small>현재 퀘스트</small><h1>제네시스 해방 계산기</h1><p><span className="trace-orb" />어둠의 흔적 <strong>{number.format(result.currentTotal)}</strong> / {number.format(TOTAL_TRACES)}</p>{state.genesisPass && <span className="pass-badge"><SealCheck weight="fill" />제네시스 패스 적용</span>}</div><div className="hero-result"><span>예상 해방일</span><strong>{result.expectedDate ? fullDate.format(result.expectedDate) : "계산 불가"}</strong><small>남은 기간 <b>{result.weeksRemaining ? `${result.weeksRemaining}주` : "—"}</b></small></div><div className="hero-progress"><span style={{ width: `${Math.min(100, result.currentTotal / TOTAL_TRACES * 100)}%` }} /><b>{(result.currentTotal / TOTAL_TRACES * 100).toFixed(1)}%</b><small>{number.format(result.currentTotal)} / {number.format(TOTAL_TRACES)}</small></div></section>
      <StageTrack currentTotal={result.currentTotal} />
      <div className="planning-grid"><section className="tool-panel week-table-panel"><h2>주차별 계획</h2><div className="week-table" role="table"><div className="week-row head" role="row"><span>주차</span><span>기간</span><span>획득 예상</span><span>누적 흔적</span><span>목표 보스</span></div>{state.detailedWeeks.slice(0, 12).map((item, index) => { const row = result.weeks[index]; const target = row?.bosses[0]?.name ?? "계획 없음"; return <button type="button" role="row" className={`week-row ${selectedWeek === index ? "active" : ""}`} key={item.weekIndex} onClick={() => setSelectedWeek(index)}><span>{index + 1}</span><span>{row ? `${rangeDate.format(row.start)} ~ ${rangeDate.format(row.end)}` : "—"}</span><strong>{number.format(row?.earned ?? 0)}</strong><span>{number.format(row?.cumulative ?? result.currentTotal)}</span><span>{target}</span></button>; })}</div></section>
        <section className="tool-panel detail-panel"><h2>{selectedWeek + 1}주차 상세 계획</h2><dl><div><dt>기간</dt><dd>{weekResult ? `${fullDate.format(weekResult.start)} ~ ${fullDate.format(weekResult.end)}` : "계획 없음"}</dd></div><div><dt>활성 보스</dt><dd>{weekResult?.bosses.length ?? 0}종</dd></div><div><dt>이번 주 획득 예상</dt><dd className="gold">{number.format(weekResult?.earned ?? 0)} 흔적</dd></div><div><dt>누적 흔적</dt><dd>{number.format(weekResult?.cumulative ?? result.currentTotal)} / {number.format(TOTAL_TRACES)}</dd></div></dl><div className="detail-split"><div><h3>주간 획득 내역</h3><ul>{weekResult?.bosses.map((boss) => <li key={`${boss.name}-${boss.difficulty}`}><span>{boss.name} · {boss.difficulty} · {boss.partySize}인</span><b>+{number.format(boss.traces)}</b></li>)}</ul></div><div><h3>주의 사항</h3>{result.warnings.map((warning) => <p className="notice" key={warning}><WarningCircle weight="fill" />{warning}</p>)}<p className="tip"><Info weight="fill" />파티 인원으로 나눈 뒤 내림 처리합니다.</p></div></div></section></div>
      <footer className="action-bar"><button type="button" className="reset" onClick={reset}><ArrowCounterClockwise weight="bold" />계산 초기화</button><button type="button" onClick={() => window.print()}><DownloadSimple />계획 저장</button></footer>
    </section></div>
  </div><aside className="disclaimer">메이플스토리 공식 서비스가 아닌 팬 제작 계산기입니다. 실제 일정은 보스 클리어와 점검 일정에 따라 달라질 수 있습니다. <a href="https://maplestory.nexon.com/news/update/762" target="_blank" rel="noreferrer">공식 해방 규칙</a> · <a href="https://maplestory.nexon.com/news/update/805" target="_blank" rel="noreferrer">제네시스 패스</a> · 데이터 기준 {DATA_AS_OF} · 이 페이지에는 메이플스토리가 제공한 메이플스토리 서체가 적용되어 있습니다.</aside></main>;
}
