import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowCounterClockwise,
  CalendarBlank,
  CaretDown,
  Hourglass,
  Info,
  Moon,
  Question,
  Printer,
  SealCheck,
  Sun,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import { BOSSES, createDefaultPlans, createDetailedWeeks, DATA_AS_OF, PASS_END, STAGES, TOTAL_TRACES, TRACE_CAP } from "./data";
import { forecast, traceReward, weekStartFor } from "./engine";
import type { BossPlan, CalculatorState, Theme } from "./types";

const STORAGE_KEY = "genesis-liberation-calculator:v1";
const TODAY = "2026-08-19";
const DAY_MS = 24 * 60 * 60 * 1000;
const number = new Intl.NumberFormat("ko-KR");
const fullDate = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });
const rangeDate = new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" });
type SidebarTab = "progress" | "bosses" | "pass";

function asset(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}

function defaultState(): CalculatorState {
  const plans = createDefaultPlans();
  return {
    version: 1,
    mode: "detailed",
    theme: "dark",
    currentStage: 3,
    stageTraces: 240,
    startDate: TODAY,
    genesisPass: true,
    simplePlans: plans,
    detailedWeeks: createDetailedWeeks(plans),
  };
}

function normalizePlans(value: unknown): BossPlan[] {
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
    return {
      version: 1,
      mode: "detailed",
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

function SelectShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`select-shell ${className}`.trim()}>{children}<CaretDown weight="bold" aria-hidden="true" /></span>;
}

function SwitchVisual({ checked, compact = false }: { checked: boolean; compact?: boolean }) {
  return <span className={`switch-visual ${checked ? "is-on" : "is-off"} ${compact ? "compact" : ""}`} aria-hidden="true">
    <span className="switch-state">{checked ? "ON" : "OFF"}</span>
    <span className="switch-thumb" />
  </span>;
}

function BossPortrait({ bossId, size = "normal", decorative = false }: { bossId: string; size?: "small" | "normal" | "large"; decorative?: boolean }) {
  const bossName = BOSSES.find((boss) => boss.id === bossId)?.name ?? STAGES.find((stage) => stage.id === bossId)?.name ?? "보스";
  return <img className={`boss-portrait ${size}`} src={asset(`assets/bosses/${bossId}.png`)} alt={decorative ? "" : `${bossName} 초상`} />;
}

function TraceIcon({ size = "normal" }: { size?: "small" | "normal" | "large" }) {
  return <img className={`trace-icon ${size}`} src={asset("assets/trace-orb.png")} alt="" />;
}

function BossList({ plans, passApplied, onChange }: { plans: BossPlan[]; passApplied: boolean; onChange: (plans: BossPlan[]) => void }) {
  const patch = (index: number, change: Partial<BossPlan>) => onChange(plans.map((plan, itemIndex) => itemIndex === index ? { ...plan, ...change } : plan));

  return <div className="boss-list">{plans.map((plan, index) => {
    const boss = BOSSES.find((item) => item.id === plan.bossId)!;
    const reward = traceReward(plan, passApplied);
    const periodLabel = boss.frequency === "monthly" ? "이번 달" : "이번 주";
    return <article className={`boss-card ${plan.enabled ? "selected" : "disabled"}`} key={boss.id}>
      <label className="boss-heading">
        <input type="checkbox" role="switch" aria-label={`${boss.name} 계획 포함`} checked={plan.enabled} onChange={(event) => patch(index, { enabled: event.target.checked })} />
        <BossPortrait bossId={boss.id} size="small" decorative />
        <span className="boss-copy"><b>{boss.name}</b><small>{boss.frequency === "monthly" ? "월간 보스" : "주간 보스"}</small></span>
        <SwitchVisual checked={plan.enabled} compact />
      </label>
      <div className="boss-controls">
        <SelectShell className="difficulty-field"><select aria-label={`${boss.name} 난이도와 예상 어둠의 흔적`} disabled={!plan.enabled} value={plan.difficultyId} onChange={(event) => patch(index, { difficultyId: event.target.value })}>{boss.difficulties.map((difficulty) => {
          const difficultyReward = traceReward({ ...plan, enabled: true, difficultyId: difficulty.id }, passApplied);
          return <option key={difficulty.id} value={difficulty.id}>{difficulty.label} · +{number.format(difficultyReward)} 흔적</option>;
        })}</select></SelectShell>
        <span className="selected-reward" aria-label={`선택 난이도 예상 획득량 ${number.format(reward)}`}><TraceIcon size="small" /><b>+{number.format(reward)}</b></span>
        <SelectShell className="party-field"><select aria-label={`${boss.name} 파티 인원`} disabled={!plan.enabled} value={plan.partySize} onChange={(event) => patch(index, { partySize: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map((party) => <option key={party} value={party}>{party}인 파티</option>)}</select></SelectShell>
        <label className="period-toggle" title={`${periodLabel}에 이미 처치했다면 켜세요`}>
          <input type="checkbox" role="switch" aria-label={`${boss.name} ${periodLabel} 처치 완료`} checked={plan.clearedCurrentPeriod} disabled={!plan.enabled} onChange={(event) => patch(index, { clearedCurrentPeriod: event.target.checked })} />
          <span aria-hidden="true">{plan.clearedCurrentPeriod ? "처치 완료" : "미처치"}</span>
        </label>
      </div>
    </article>;
  })}</div>;
}

function StageTrack({ currentTotal }: { currentTotal: number }) {
  let threshold = 0;
  return <section className="tool-panel stage-panel">
    <h2>해방 진행 단계</h2>
    <div className="stage-grid">{STAGES.map((stage) => {
      threshold += stage.requirement;
      const complete = currentTotal >= threshold;
      const active = !complete && currentTotal >= threshold - stage.requirement;
      return <article className={`${complete ? "complete" : ""} ${active ? "active" : ""}`} key={stage.id}>
        <span className="roman">{stage.roman}</span><b>{stage.name}</b><small>{complete ? "완료" : active ? "진행 중" : "잠김"}</small>
      </article>;
    })}</div>
  </section>;
}

export function App() {
  const [state, setState] = useState<CalculatorState>(loadState);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [activeTab, setActiveTab] = useState<SidebarTab>("bosses");
  const result = useMemo(() => forecast({ ...state, mode: "detailed" }), [state]);
  const resultWithoutPass = useMemo(() => forecast({ ...state, mode: "detailed", genesisPass: false }), [state]);
  const week = state.detailedWeeks[selectedWeek];
  const weekResult = result.weeks[selectedWeek];
  const requirement = STAGES[state.currentStage]?.requirement ?? 1000;
  const currentStage = STAGES[state.currentStage] ?? STAGES[0];
  const progressPercent = Math.min(100, result.currentTotal / TOTAL_TRACES * 100);
  const passEnd = new Date(PASS_END);
  const selectedWeekStart = new Date(weekStartFor(state.startDate).getTime() + selectedWeek * 7 * DAY_MS);
  const selectedWeekPassApplied = state.genesisPass && selectedWeekStart.getTime() <= passEnd.getTime();
  const selectedWeekPassStatus = !state.genesisPass
    ? { className: "off", label: "패스 OFF · 기본 획득" }
    : selectedWeekPassApplied
      ? { className: "on", label: "패스 ON · 흔적 3배" }
      : { className: "expired", label: "구매 ON · 이 주차 미적용" };
  const updateWeekPlans = (plans: BossPlan[]) => setState((previous) => ({ ...previous, detailedWeeks: previous.detailedWeeks.map((item, index) => index === selectedWeek ? { ...item, plans } : item) }));

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { document.documentElement.dataset.theme = state.theme; }, [state.theme]);

  const reset = () => {
    if (window.confirm("저장된 진행 상황과 주차별 계획을 초기화할까요?")) {
      setState(defaultState());
      setSelectedWeek(0);
      setActiveTab("bosses");
    }
  };
  const setTheme = (theme: Theme) => setState((previous) => ({ ...previous, theme }));

  return <main className="app-shell">
    <div className="tool-window">
      <header className="tool-titlebar">
        <strong>GENESIS LIBERATION</strong>
        <div className="title-actions">
          <a className="icon-button" href="https://maplestory.nexon.com/news/update/762" target="_blank" rel="noreferrer" aria-label="공식 해방 규칙 열기"><Question weight="bold" /></a>
          <button type="button" className="icon-button" aria-label={state.theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"} onClick={() => setTheme(state.theme === "dark" ? "light" : "dark")}>{state.theme === "dark" ? <Sun /> : <Moon />}</button>
        </div>
      </header>

      <div className="workspace">
        <aside className="control-column">
          <nav className="tool-tabs" aria-label="해방 계산 설정">
            <button className={activeTab === "progress" ? "active" : ""} type="button" onClick={() => setActiveTab("progress")}>진척</button>
            <button className={activeTab === "bosses" ? "active" : ""} type="button" onClick={() => setActiveTab("bosses")}>보스</button>
            <button className={activeTab === "pass" ? "active" : ""} type="button" onClick={() => setActiveTab("pass")}>패스</button>
          </nav>

          <div className="sidebar-content">
            {activeTab === "progress" && <section className="tool-panel sidebar-pane progress-pane">
              <h2>현재 진행</h2>
              <div className="setting-stack">
                <label><span>현재 퀘스트</span><SelectShell><select value={state.currentStage} onChange={(event) => setState((previous) => ({ ...previous, currentStage: Number(event.target.value), stageTraces: 0 }))}>{STAGES.map((item, index) => <option key={item.id} value={index}>{index + 1}단계 · {item.name}</option>)}</select></SelectShell></label>
                <label><span>보유 흔적</span><span className="number-field"><input type="number" min="0" max={TRACE_CAP} value={state.stageTraces} onChange={(event) => setState((previous) => ({ ...previous, stageTraces: Math.max(0, Math.min(TRACE_CAP, Number(event.target.value) || 0)) }))} /><b>/ {number.format(requirement)}</b></span></label>
                <label><span>계산 시작일</span><input className="date-field" type="date" value={state.startDate} onChange={(event) => setState((previous) => ({ ...previous, startDate: event.target.value }))} /></label>
              </div>
              <div className="progress-snapshot"><TraceIcon size="large" /><div><small>현재 어둠의 흔적</small><strong>{number.format(result.currentTotal)}</strong><span>/ {number.format(TOTAL_TRACES)}</span></div></div>
              <div className="snapshot-grid"><div><small>다음 목표</small><b>{result.nextStageName}</b></div><div><small>남은 흔적</small><b>{number.format(result.remaining)}</b></div></div>
            </section>}

            {activeTab === "bosses" && <section className="tool-panel sidebar-pane boss-pane">
              <h2><span>보스 계획</span><span className="boss-pane-status"><small>{selectedWeek + 1}주차</small><em className={selectedWeekPassStatus.className}>{selectedWeekPassStatus.label}</em></span></h2>
              <BossList plans={week?.plans ?? []} passApplied={selectedWeekPassApplied} onChange={updateWeekPlans} />
              <p className="pane-hint"><Info weight="fill" /> 난이도별 수치는 선택 주차의 파티 인원과 패스 효과를 반영한 1인 획득량입니다.</p>
            </section>}

            {activeTab === "pass" && <section className="tool-panel sidebar-pane pass-pane">
              <h2>제네시스 패스</h2>
              <button type="button" role="switch" className={`pass-switch ${state.genesisPass ? "enabled" : ""}`} aria-label="제네시스 패스 구매" aria-checked={state.genesisPass} onClick={() => setState((previous) => ({ ...previous, genesisPass: !previous.genesisPass }))}>
                <SealCheck weight="fill" /><span className="pass-switch-copy"><b>제네시스 패스 구매</b><small>보스 처치 시 어둠의 흔적 3배</small></span><SwitchVisual checked={state.genesisPass} />
              </button>
              <div className="pass-season"><CalendarBlank weight="fill" /><span><small>효과 종료</small><b>{fullDate.format(passEnd)}</b></span></div>
              <div className="pass-comparison"><div><small>패스 적용</small><b>{result.weeksRemaining ? `${result.weeksRemaining}주` : "계산 불가"}</b><span>{result.expectedDate ? fullDate.format(result.expectedDate) : "—"}</span></div><div><small>패스 미적용</small><b>{resultWithoutPass.weeksRemaining ? `${resultWithoutPass.weeksRemaining}주` : "계산 불가"}</b><span>{resultWithoutPass.expectedDate ? fullDate.format(resultWithoutPass.expectedDate) : "—"}</span></div></div>
              <p className="pass-note"><Info weight="fill" /> 패스 종료 이후 주차는 일반 획득량으로 자동 전환됩니다.</p>
            </section>}
          </div>

          <section className="selected-week-card" aria-live="polite">
            <span className="week-emblem">{selectedWeek + 1}</span>
            <div><small>선택한 주차</small><b>{weekResult ? `${rangeDate.format(weekResult.start)} ~ ${rangeDate.format(weekResult.end)}` : "계획 없음"}</b></div>
            <div className="week-earning"><small>획득 예상</small><strong><TraceIcon size="small" />{number.format(weekResult?.earned ?? 0)}</strong></div>
          </section>
        </aside>

        <section className="content-column">
          <section className="quest-hero" aria-live="polite">
            <div className="current-quest"><BossPortrait bossId={currentStage.id} size="large" decorative /><div><small>현재 퀘스트 · {state.currentStage + 1}단계</small><h1>제네시스 해방 계산기</h1><p><b>{currentStage.roman}. {currentStage.name}</b>의 흔적을 수집 중입니다.</p></div></div>
            <div className="trace-summary"><TraceIcon size="large" /><div><small>어둠의 흔적</small><strong>{number.format(result.currentTotal)}</strong><span>/ {number.format(TOTAL_TRACES)}</span></div>{state.genesisPass && <em><SealCheck weight="fill" /> 패스 적용</em>}</div>
            <div className="hero-result"><CalendarBlank weight="fill" /><div><span>예상 해방일</span><strong>{result.expectedDate ? fullDate.format(result.expectedDate) : "계산 불가"}</strong><small>남은 기간 <b>{result.weeksRemaining ? `${result.weeksRemaining}주` : "—"}</b></small></div></div>
            <div className="hero-progress"><span style={{ width: `${progressPercent}%` }} /><b>{progressPercent.toFixed(1)}%</b><small>{number.format(result.remaining)} 남음</small></div>
          </section>

          <StageTrack currentTotal={result.currentTotal} />

          <section className="tool-panel planner-panel">
            <h2>주차별 해방 계획 <small>주차를 선택하면 좌측 보스 설정이 함께 변경됩니다.</small></h2>
            <div className="planner-content">
              <div className="week-board" role="list" aria-label="주차별 계획">{state.detailedWeeks.slice(0, 12).map((item, index) => {
                const row = result.weeks[index];
                return <button type="button" role="listitem" className={`week-tile ${selectedWeek === index ? "active" : ""} ${row?.passApplied ? "pass" : ""}`} key={item.weekIndex} onClick={() => setSelectedWeek(index)}>
                  <span><b>{index + 1}주차</b>{row?.passApplied && <em>PASS</em>}</span>
                  <small>{row ? `${rangeDate.format(row.start)} ~ ${rangeDate.format(row.end)}` : "계획 없음"}</small>
                  <strong>+{number.format(row?.earned ?? 0)}</strong><i>{number.format(row?.cumulative ?? result.currentTotal)}</i>
                </button>;
              })}</div>

              <div className="week-detail">
                <div className="detail-meta">
                  <div><CalendarBlank weight="fill" /><span><small>기간</small><b>{weekResult ? `${rangeDate.format(weekResult.start)} ~ ${rangeDate.format(weekResult.end)}` : "계획 없음"}</b></span></div>
                  <div><UsersThree weight="fill" /><span><small>활성 보스</small><b>{weekResult?.bosses.length ?? 0}종</b></span></div>
                  <div><TraceIcon size="small" /><span><small>획득 예상</small><b className="gold">{number.format(weekResult?.earned ?? 0)}</b></span></div>
                  <div><Hourglass weight="fill" /><span><small>누적 흔적</small><b>{number.format(weekResult?.cumulative ?? result.currentTotal)}</b></span></div>
                </div>

                <div className="reward-grid">{weekResult?.bosses.length ? weekResult.bosses.map((boss) => {
                  const definition = BOSSES.find((item) => item.name === boss.name)!;
                  return <article key={`${boss.name}-${boss.difficulty}`}><BossPortrait bossId={definition.id} size="small" decorative /><span><b>{boss.name}</b><small>{boss.difficulty} · {boss.partySize}인</small></span><strong>+{number.format(boss.traces)}</strong></article>;
                }) : <p className="empty-plan">이 주차에 활성화된 보스가 없습니다.</p>}</div>

                <div className="alerts">{result.warnings.map((warning) => <p className="notice" key={warning}><WarningCircle weight="fill" />{warning}</p>)}<p className="tip"><Info weight="fill" />파티 인원으로 나눈 뒤 내림 처리합니다.</p></div>
              </div>
            </div>
          </section>

          <footer className="action-bar">
            <button type="button" className="game-button secondary" onClick={reset}><ArrowCounterClockwise weight="bold" />계산 초기화</button>
            <button type="button" className="game-button primary" onClick={() => window.print()}><Printer weight="bold" />인쇄 · PDF 저장</button>
          </footer>
        </section>
      </div>

      <footer className="disclaimer">메이플스토리 공식 서비스가 아닌 비영리 팬 제작 계산기입니다. <a href="https://maplestory.nexon.com/news/update/762" target="_blank" rel="noreferrer">공식 해방 규칙</a> · <a href="https://maplestory.nexon.com/news/update/805" target="_blank" rel="noreferrer">제네시스 패스</a> · 데이터 기준 {DATA_AS_OF} · 팬 제작 초상 사용 · 메이플스토리 서체 출처 표기</footer>
    </div>
  </main>;
}
