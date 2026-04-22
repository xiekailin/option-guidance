"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from "react";
import { Activity, AlertTriangle, ArrowLeft, ArrowUpRight, BookOpen, CircleHelp, Compass, ListChecks, Radar, Route, ShieldAlert, Sparkles, Target } from "lucide-react";
import { ScenariosSection } from "@/components/newPages2/scenarios-section";
import { SectionHeader } from "@/components/newPages2/section-header";
import { StrategiesSection } from "@/components/newPages2/strategies-section";
import { TerminalSidebar, TerminalTabs, type TerminalNavItem, type TerminalSectionKey } from "@/components/newPages2/terminal-nav";
import { WorkflowSection } from "@/components/newPages2/workflow-section";
import { Dialog } from "@/components/ui/dialog";

type Tone = "cyan" | "fuchsia" | "amber" | "emerald";

type TerminalScenario = {
  id: string;
  stage: string;
  title: string;
  subtitle: string;
  description: string;
  trigger: string;
  action: string;
  risk: string;
  fit: string;
  evidence: string[];
  bestRoles: string[];
  tone: Tone;
};

type OpportunityCard = {
  name: string;
  bias: string;
  edge: string;
  execution: string;
  warning: string;
  bestFor: string;
  capital: string;
  decay: string;
  tone: Tone;
};

type WorkflowStep = {
  title: string;
  description: string;
  output: string;
  warning: string;
  tone: Tone;
};

type MistakeCase = {
  title: string;
  thought: string;
  reality: string;
  correction: string;
  tone: Tone;
};

const terminalNavItems: TerminalNavItem[] = [
  { key: "overview", label: "页面总览", shortLabel: "总览", icon: <Compass className="size-4" />, href: "#overview" },
  { key: "scenarios", label: "市场剧本", shortLabel: "剧本", icon: <Sparkles className="size-4" />, href: "#scenarios" },
  { key: "strategies", label: "策略角色", shortLabel: "策略", icon: <Activity className="size-4" />, href: "#strategies" },
  { key: "checklist", label: "决策检查", shortLabel: "检查", icon: <ListChecks className="size-4" />, href: "#checklist" },
  { key: "workflow", label: "作战流程", shortLabel: "流程", icon: <Route className="size-4" />, href: "#workflow" },
  { key: "mistakes", label: "常见误判", shortLabel: "误判", icon: <AlertTriangle className="size-4" />, href: "#mistakes" },
  { key: "about", label: "版本说明", shortLabel: "说明", icon: <BookOpen className="size-4" />, href: "#about" },
];

const overviewCards = [
  {
    title: "这页是干嘛的",
    description: "不是替代 1.0 的实时推荐页，而是把判断逻辑、策略角色、风控顺序压成一张作战地图。",
  },
  {
    title: "建议怎么读",
    description: "先看市场剧本，再看策略角色，再过一遍决策检查和作战流程，最后决定今天是观察、埋伏还是执行。",
  },
  {
    title: "当前版本边界",
    description: "这页现在用的是演示级信息架构，不接 1.0 的实时排序、筛选和详情抽屉，所以更适合做判断，不适合直接替代下单前检查。",
  },
];

const scenarios: TerminalScenario[] = [
  {
    id: "calm-grind",
    stage: "市场剧本 A",
    title: "慢慢磨上去，不给你舒服上车",
    subtitle: "适合先拿稳定收益，再留一点追击余地。",
    description:
      "价格不是暴冲，而是每天抬一点、回一点，逼着你不断怀疑是不是已经涨完了。这个阶段最怕的不是错过，而是为了追求更高收益，把执行价卖得太近，最后涨是真涨，收益却被封死。",
    trigger: "现货缓慢抬高，盘口深度正常，隐波不算夸张。",
    action: "优先看留有安全垫的 covered call，别把甜头都押在最短周期。",
    risk: "如果你卖得太近，最后会出现“方向看对了，钱却没赚够”的懊恼。",
    fit: "适合“先把时间价值收回来，但不想马上追涨”的阶段。",
    evidence: [
      "价格往上走，但每次回踩都没有明显失控。",
      "波动率不低不高，说明市场有情绪，但还没过热。",
      "这种时候收租还能做，但执行价一定要留距离。",
    ],
    bestRoles: ["Covered Call", "轻仓 Long Call"],
    tone: "cyan",
  },
  {
    id: "fake-calm",
    stage: "市场剧本 B",
    title: "表面安静，后面突然抽一下",
    subtitle: "适合先把风控想清楚，再决定收租还是转进攻。",
    description:
      "盘面一开始看着很安静，波动也不吓人，但真正的问题是它可能突然来一根快速拉升或下砸。这个时候，所有“看起来年化很高”的仓位都会瞬间暴露出真面目：你到底是在赚时间价值，还是在赌方向。",
    trigger: "短时间内量能放大，期权盘口价差拉宽，IV 开始跳。",
    action: "先盯流动性和执行价距离，再决定要不要开仓，不要只看收益率数字。",
    risk: "仓位一旦开在波动切换前，后面会很被动，想滚仓都未必有好价。",
    fit: "适合“现在看着没事，但总觉得要来一下”的敏感阶段。",
    evidence: [
      "K 线不大，但盘口和波动率开始变躁。",
      "短端权利金突然变香，往往说明市场在给风险定价。",
      "这个阶段最容易被“年化漂亮”骗进去。",
    ],
    bestRoles: ["Cash-Secured Put", "观望优先"],
    tone: "amber",
  },
  {
    id: "trend-breakout",
    stage: "市场剧本 C",
    title: "趋势真的来了，别再假装它只是反弹",
    subtitle: "适合把收租思路和方向思路彻底分开。",
    description:
      "当趋势被确认以后，最大的错误不是没仓位，而是还在用收租的脑子处理趋势行情。真正的强趋势里，Synthetic Long 和 Long Call 的价值会开始变大，因为它们能让你把利润空间重新打开，而不是一直纠结那一点点权利金。",
    trigger: "价格突破关键区间后站稳，未平仓和成交量一起放大。",
    action: "只要判断偏强，就把进攻仓和收租仓分开，别用一个策略解决所有问题。",
    risk: "继续执着短期收租，可能会在最有肉的阶段把自己锁在天花板下面。",
    fit: "适合“市场已经给出明牌，你不能再装看不见”的阶段。",
    evidence: [
      "价格突破后不是假穿，而是站住了。",
      "成交量、未平仓和情绪一起抬头。",
      "这时该问的不是“还能不能收租”，而是“我是不是该让利润空间打开”。",
    ],
    bestRoles: ["Synthetic Long", "Long Call"],
    tone: "fuchsia",
  },
];

const opportunities: OpportunityCard[] = [
  {
    name: "Covered Call",
    bias: "稳中带守",
    edge: "现货在手、想先把时间价值收回来。",
    execution: "优先选还有距离的执行价，收益少一点也比被秒封顶好。",
    warning: "强趋势里不要恋战，不然容易赚小头丢大行情。",
    bestFor: "适合已经拿着现货、重点是提高持仓效率的人。",
    capital: "资金占用高，但逻辑简单。",
    decay: "你是时间价值的收租方。",
    tone: "cyan",
  },
  {
    name: "Cash-Secured Put",
    bias: "等回撤接货",
    edge: "想要更低成本拿现货，又不怕真被指派。",
    execution: "先确认现金足够，再挑你真的愿意接货的价位。",
    warning: "不要把“愿意接货”说着玩，跌下来你得真的接得住。",
    bestFor: "适合本来就想买币，只是不想现在直接追的人。",
    capital: "需要真现金做后盾，不能嘴上接货。",
    decay: "你同样在收时间价值，但前提是你真能接。",
    tone: "emerald",
  },
  {
    name: "Synthetic Long",
    bias: "方向进攻",
    edge: "看多明确，又想用更高效率去放大趋势利润。",
    execution: "先算下行义务，再看净权利金，不要只看表面便宜。",
    warning: "这是带杠杆味道的方向单，错了会比收租疼得多。",
    bestFor: "适合已经确认方向，愿意接受更高波动的人。",
    capital: "名义占用效率高，但心智负担也高。",
    decay: "不是单纯跟时间对赌，而是把方向判断放大。",
    tone: "fuchsia",
  },
  {
    name: "Long Call",
    bias: "轻仓博弹性",
    edge: "控制最大亏损，给自己买一张趋势门票。",
    execution: "重点看期限和 delta，别贪最便宜的虚值彩票。",
    warning: "时间衰减会一直咬你，方向慢半拍都可能磨掉利润。",
    bestFor: "适合看多但不想先承担接货义务的人。",
    capital: "门槛最低，但对时机要求高。",
    decay: "你是时间价值的支付方，拖太久会很难受。",
    tone: "amber",
  },
];

const strategyAxes = [
  {
    label: "防守性",
    values: ["Covered Call：高", "Cash-Secured Put：中高", "Synthetic Long：低", "Long Call：中"],
  },
  {
    label: "进攻弹性",
    values: ["Covered Call：低", "Cash-Secured Put：低", "Synthetic Long：高", "Long Call：中高"],
  },
  {
    label: "资金效率",
    values: ["Covered Call：中", "Cash-Secured Put：中", "Synthetic Long：高", "Long Call：高"],
  },
  {
    label: "新手友好度",
    values: ["Covered Call：高", "Cash-Secured Put：中高", "Synthetic Long：低", "Long Call：中"],
  },
];

const watchlist = [
  "BTC 现货是否继续站在关键区间上方。",
  "近月 IV 是温和抬升，还是突然抽高。",
  "盘口价差有没有因为情绪波动明显变宽。",
  "你现在更想赚权利金，还是更想吃趋势。",
];

const riskGates = [
  "不因为年化好看就忽视执行价太近。",
  "不因为想抄底就卖自己根本不想接的 put。",
  "不把 Synthetic Long 当成“便宜现货”去乱上杠杆。",
  "不拿 Long Call 去赌没有催化的横盘市场。",
];

const executionSteps = [
  "先判断现在是震荡、回撤，还是趋势行情。",
  "再决定你要收租、等接货，还是直接做方向。",
  "最后才去看具体合约，不要把顺序搞反。",
  "如果还说不清最大风险，就先不动手。",
];

const workflowSteps: WorkflowStep[] = [
  {
    title: "先定市场语气",
    description: "先回答今天到底是慢涨、假平静，还是趋势打开。别一上来就看某个合约甜不甜。",
    output: "得到一个市场剧本，而不是一堆分散感受。",
    warning: "没有剧本就开仓，后面所有动作都会变得被动。",
    tone: "cyan",
  },
  {
    title: "再选策略角色",
    description: "明确你现在是要收租、等接货，还是吃趋势弹性。一个仓位只负责一件事。",
    output: "把 Covered Call、CSP、Synthetic Long、Long Call 分配到正确位置。",
    warning: "别用收租策略解决趋势问题，也别用方向仓去装保守。",
    tone: "emerald",
  },
  {
    title: "最后过风险边界",
    description: "确认你最怕什么：被封顶、被接货、时间衰减，还是方向做反。只有把最怕的说清楚，策略才算选对。",
    output: "知道自己最坏会输在哪里，而不是只看最好的收益图。",
    warning: "如果你连最坏情况都不愿面对，这单就还没准备好。",
    tone: "amber",
  },
  {
    title: "决定观察还是执行",
    description: "不是每天都必须下单。有时候最好的动作，就是承认今天市场还没给明牌。",
    output: "形成“现在动 / 等确认 / 继续观察”的明确动作结论。",
    warning: "把无聊误当机会，是交易里最常见也最贵的错误。",
    tone: "fuchsia",
  },
];

const mistakeCases: MistakeCase[] = [
  {
    title: "把横盘当趋势",
    thought: "涨了几根，我怕踏空，赶紧上进攻仓。",
    reality: "结果价格没走远，时间先把你磨得没脾气。",
    correction: "先确认趋势站稳，再决定是不是用 Long Call 或 Synthetic Long。",
    tone: "amber",
  },
  {
    title: "把高 IV 当高胜率",
    thought: "年化这么高，不卖白不卖。",
    reality: "高收益往往只是市场在提醒你：风险也比平时贵得多。",
    correction: "先看执行价距离和盘口流动性，再看收益率。",
    tone: "fuchsia",
  },
  {
    title: "嘴上说愿意接货",
    thought: "卖个 put 吧，反正接货也没事。",
    reality: "真跌下来以后，你会发现自己其实根本不想接，也没准备好现金。",
    correction: "只有在你真的愿意买现货、现金也够时，CSP 才成立。",
    tone: "emerald",
  },
  {
    title: "用收租仓硬扛趋势",
    thought: "反正还能收权利金，我先继续卖近一点。",
    reality: "最后行情走出来了，你赚了小租，丢了大段利润空间。",
    correction: "趋势一旦确认，就把收租仓和进攻仓分开处理。",
    tone: "cyan",
  },
];

const roadmap = [
  "接入真实市场状态，让 2.0 不只会讲剧本，还能跟行情同步。",
  "接入候选机会层，把“该做什么”进一步落到“哪一类机会值得看”。",
  "接入执行计划与下单前检查，让 2.0 从方法论页进化成真正的作战台。",
];

const sectionKeys = terminalNavItems.map((item) => item.key);
const visitedSectionTargets: TerminalSectionKey[] = ["scenarios", "strategies", "checklist", "workflow"];
const mobileSectionOffset = 136;
const desktopSectionOffset = 96;
const sectionAlignmentTolerance = 24;

function isSectionKey(value: string): value is TerminalSectionKey {
  return sectionKeys.includes(value as TerminalSectionKey);
}

function getSectionScrollOffset() {
  return window.matchMedia("(min-width: 640px)").matches ? desktopSectionOffset : mobileSectionOffset;
}

function getScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function toneClasses(tone: Tone) {
  switch (tone) {
    case "fuchsia":
      return {
        badge: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200",
        glow: "from-fuchsia-400/30 via-fuchsia-300/10 to-transparent",
        ring: "ring-fuchsia-300/40",
        accent: "text-fuchsia-200",
      };
    case "amber":
      return {
        badge: "border-amber-400/30 bg-amber-500/10 text-amber-200",
        glow: "from-amber-400/30 via-amber-300/10 to-transparent",
        ring: "ring-amber-300/40",
        accent: "text-amber-200",
      };
    case "emerald":
      return {
        badge: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
        glow: "from-emerald-400/30 via-emerald-300/10 to-transparent",
        ring: "ring-emerald-300/40",
        accent: "text-emerald-200",
      };
    default:
      return {
        badge: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
        glow: "from-cyan-400/30 via-cyan-300/10 to-transparent",
        ring: "ring-cyan-300/40",
        accent: "text-cyan-100",
      };
  }
}


function getNextIndex(event: ReactKeyboardEvent<HTMLElement>, index: number, total: number) {
  if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
    return null;
  }

  event.preventDefault();
  const lastIndex = total - 1;

  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    return index === lastIndex ? 0 : index + 1;
  }

  if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    return index === 0 ? lastIndex : index - 1;
  }

  if (event.key === "Home") {
    return 0;
  }

  return lastIndex;
}

function focusRadioAt(container: HTMLElement, index: number) {
  const radios = container.querySelectorAll<HTMLElement>("[role='radio']");
  const target = radios[index];
  target?.focus();
}

function isRoleRecommended(roleName: string, bestRoles: string[]) {
  return bestRoles.some((role) => {
    const normalizedRole = role.replace(/^轻仓\s+/, "").trim();
    return normalizedRole === roleName || normalizedRole.includes(roleName) || roleName.includes(normalizedRole);
  });
}

function getLikelyMistakeTitle(activeScenario: TerminalScenario, activeStrategy: OpportunityCard) {
  if (activeStrategy.name === "Cash-Secured Put") {
    return "嘴上说愿意接货";
  }

  if (activeScenario.id === "trend-breakout" && activeStrategy.name === "Covered Call") {
    return "用收租仓硬扛趋势";
  }

  if (activeScenario.id === "fake-calm") {
    return "把高 IV 当高胜率";
  }

  if (activeStrategy.name === "Long Call" || activeStrategy.name === "Synthetic Long") {
    return "把横盘当趋势";
  }

  return "用收租仓硬扛趋势";
}

function getMistakeReviewTarget(title: string): TerminalSectionKey {
  switch (title) {
    case "嘴上说愿意接货":
    case "用收租仓硬扛趋势":
      return "strategies";
    case "把高 IV 当高胜率":
      return "checklist";
    default:
      return "scenarios";
  }
}

export default function OptionsTerminalPage() {
  const [activeScenarioId, setActiveScenarioId] = useState(scenarios[0]?.id ?? "");
  const [activeStrategyName, setActiveStrategyName] = useState(opportunities[0]?.name ?? "");
  const [activeWorkflowIndex, setActiveWorkflowIndex] = useState(0);
  const [activeSection, setActiveSection] = useState<TerminalSectionKey>("overview");
  const [visitedSections, setVisitedSections] = useState<TerminalSectionKey[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingSectionRef = useRef<TerminalSectionKey | null>(null);

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0],
    [activeScenarioId],
  );
  const activeStrategy = useMemo(
    () => opportunities.find((opportunity) => opportunity.name === activeStrategyName) ?? opportunities[0],
    [activeStrategyName],
  );
  const activeWorkflow = workflowSteps[activeWorkflowIndex] ?? workflowSteps[0];
  const activeNavItem = terminalNavItems.find((item) => item.key === activeSection) ?? terminalNavItems[0];
  const activeSectionIndex = terminalNavItems.findIndex((item) => item.key === activeSection);
  const routeProgress = `${String(activeSectionIndex + 1).padStart(2, "0")} / ${String(terminalNavItems.length).padStart(2, "0")}`;
  const activeScenarioRecommendedRoles = activeScenario.bestRoles;

  const activeTone = toneClasses(activeScenario.tone);
  const activeStrategyTone = toneClasses(activeStrategy.tone);
  const activeWorkflowTone = toneClasses(activeWorkflow.tone);
  const highlightedMistakeTitle = useMemo(() => getLikelyMistakeTitle(activeScenario, activeStrategy), [activeScenario, activeStrategy]);
  const highlightedMistake = useMemo(
    () => mistakeCases.find((item) => item.title === highlightedMistakeTitle) ?? mistakeCases[0],
    [highlightedMistakeTitle],
  );
  const highlightedMistakeTone = toneClasses(highlightedMistake.tone);
  const highlightedMistakeTarget = getMistakeReviewTarget(highlightedMistake.title);
  const dynamicMetrics = useMemo(
    () => [
      {
        label: "市场状态",
        value: activeScenario.stage,
        note: activeScenario.subtitle,
      },
      {
        label: "当前角色",
        value: activeStrategy.name,
        note: activeStrategy.bias,
      },
      {
        label: "下一动作",
        value: `步骤 0${activeWorkflowIndex + 1}`,
        note: activeWorkflow.output,
      },
      {
        label: "核心风险",
        value: highlightedMistake.title,
        note: highlightedMistake.correction,
      },
    ],
    [activeScenario, activeStrategy, activeWorkflow, activeWorkflowIndex, highlightedMistake],
  );
  const contextualWatchlist = useMemo(
    () => [watchlist[0], activeScenario.trigger, activeScenario.evidence[0], watchlist[3]].filter(Boolean),
    [activeScenario],
  );
  const contextualRiskGates = useMemo(
    () => [riskGates[0], activeStrategy.warning, riskGates[2], activeScenario.risk].filter(Boolean),
    [activeScenario, activeStrategy],
  );
  const contextualExecutionSteps = useMemo(
    () => executionSteps.map((item, index) => ({ item, isCurrent: index === activeWorkflowIndex })),
    [activeWorkflowIndex],
  );
  const suggestedWorkflowIndex = useMemo(() => {
    if (activeStrategy.name === "Covered Call" || activeStrategy.name === "Cash-Secured Put") {
      return 2;
    }

    if (activeStrategy.name === "Synthetic Long" || activeStrategy.name === "Long Call") {
      return 1;
    }

    return Math.min(activeWorkflowIndex, workflowSteps.length - 1);
  }, [activeStrategy.name, activeWorkflowIndex]);
  const suggestedWorkflowLabel = workflowSteps[suggestedWorkflowIndex]?.title ?? workflowSteps[0]?.title ?? "查看流程";

  const navigateToSection = (section: TerminalSectionKey) => {
    const target = document.getElementById(section);
    if (!(target instanceof HTMLElement)) {
      return;
    }
    pendingSectionRef.current = section;
    setActiveSection(section);
    setVisitedSections((current) => (current.includes(section) ? current : [...current, section]));
    window.history.pushState(null, "", `#${section}`);
    target.focus({ preventScroll: true });
    const top = window.scrollY + target.getBoundingClientRect().top - getSectionScrollOffset();
    window.scrollTo({ top: Math.max(top, 0), behavior: getScrollBehavior() });
  };

  useEffect(() => {
    const sections = sectionKeys
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node instanceof HTMLElement);

    if (sections.length === 0) {
      return;
    }

    const scrollToSection = (target: HTMLElement, behavior: ScrollBehavior) => {
      const top = window.scrollY + target.getBoundingClientRect().top - getSectionScrollOffset();
      window.scrollTo({ top: Math.max(top, 0), behavior });
    };

    const focusSection = (target: HTMLElement) => {
      target.focus({ preventScroll: true });
    };

    const resolveActiveSection = () => {
      const offset = getSectionScrollOffset();
      const markerY = Math.min(offset + Math.max(window.innerHeight * 0.22, 40), window.innerHeight - 40);
      const sectionInMarker = sections.find((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= markerY && rect.bottom > markerY;
      });

      if (sectionInMarker && isSectionKey(sectionInMarker.id)) {
        return sectionInMarker.id;
      }

      const passedSections = sections.filter((section) => section.getBoundingClientRect().top <= offset + sectionAlignmentTolerance);
      const fallbackSection = passedSections.at(-1) ?? sections[0];
      return fallbackSection && isSectionKey(fallbackSection.id) ? fallbackSection.id : null;
    };

    const updateActiveSection = () => {
      const offset = getSectionScrollOffset();
      const pendingSection = pendingSectionRef.current;
      if (pendingSection) {
        const lockedTarget = document.getElementById(pendingSection);
        if (lockedTarget instanceof HTMLElement) {
          const rect = lockedTarget.getBoundingClientRect();
          const markerY = Math.min(offset + Math.max(window.innerHeight * 0.22, 40), window.innerHeight - 40);
          const isAligned = Math.abs(rect.top - offset) <= sectionAlignmentTolerance;
          const markerInsideTarget = rect.top <= markerY && rect.bottom > markerY;
          if (isAligned || markerInsideTarget) {
            setActiveSection(pendingSection);
            pendingSectionRef.current = null;
            return;
          }
        } else {
          pendingSectionRef.current = null;
        }
      }

      const nextSection = resolveActiveSection();
      if (nextSection) {
        setActiveSection(nextSection);
        if (visitedSectionTargets.includes(nextSection)) {
          setVisitedSections((current) => (current.includes(nextSection) ? current : [...current, nextSection]));
        }
      }
    };

    const createSectionObserver = () =>
      new IntersectionObserver(() => updateActiveSection(), {
        rootMargin: `${-getSectionScrollOffset()}px 0px -55% 0px`,
        threshold: [0, 0.2, 0.45, 0.7],
      });

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (!isSectionKey(hash)) {
        return;
      }
      const target = document.getElementById(hash);
      if (!(target instanceof HTMLElement)) {
        return;
      }
      pendingSectionRef.current = hash;
      setActiveSection(hash);
      scrollToSection(target, "auto");
      focusSection(target);
    };

    let observer = createSectionObserver();

    sections.forEach((section) => observer.observe(section));

    const reconnectObserver = () => {
      observer.disconnect();
      observer = createSectionObserver();
      sections.forEach((section) => observer.observe(section));
      updateActiveSection();
    };

    let scrollSyncFrame: number | null = null;
    const syncActiveSection = () => {
      if (scrollSyncFrame != null) {
        return;
      }
      scrollSyncFrame = window.requestAnimationFrame(() => {
        scrollSyncFrame = null;
        updateActiveSection();
      });
    };

    const initialHash = window.location.hash.slice(1);
    if (isSectionKey(initialHash)) {
      const target = document.getElementById(initialHash);
      if (target instanceof HTMLElement) {
        pendingSectionRef.current = initialHash;
        const frame = window.requestAnimationFrame(() => {
          setActiveSection(initialHash);
          scrollToSection(target, "auto");
          focusSection(target);
        });
        window.addEventListener("hashchange", handleHashChange);
        window.addEventListener("scroll", syncActiveSection, { passive: true });
        window.addEventListener("resize", reconnectObserver, { passive: true });
        return () => {
          window.cancelAnimationFrame(frame);
          observer.disconnect();
          window.removeEventListener("hashchange", handleHashChange);
          window.removeEventListener("scroll", syncActiveSection);
          window.removeEventListener("resize", reconnectObserver);
          if (scrollSyncFrame != null) {
            window.cancelAnimationFrame(scrollSyncFrame);
          }
        };
      }
    }

    updateActiveSection();
    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("resize", reconnectObserver, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("resize", reconnectObserver);
      if (scrollSyncFrame != null) {
        window.cancelAnimationFrame(scrollSyncFrame);
      }
    };
  }, []);

  const handleNavigate = (section: TerminalSectionKey, event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigateToSection(section);
  };

  return (
    <main className="min-h-screen overflow-x-hidden text-slate-100">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
        <div className="relative flex flex-col gap-5 lg:pl-[5.9rem]">
          <TerminalSidebar navItems={terminalNavItems} activeSection={activeSection} visitedSections={visitedSections} onNavigate={handleNavigate} />
          <TerminalTabs navItems={terminalNavItems} activeSection={activeSection} visitedSections={visitedSections} onNavigate={handleNavigate} />

          <section className="panel-surface relative overflow-hidden rounded-[26px] px-4 py-3.5 sm:px-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(90deg,rgba(34,211,238,0.16),rgba(34,211,238,0.04),transparent)]" />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-cyan-400/16 via-cyan-300/6 to-transparent" />
            <div className="panel-shell-fade-bar" />
            <div className="panel-shell-content flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-[18px] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.18),rgba(34,211,238,0.08))] text-cyan-100 shadow-[0_10px_28px_-16px_rgba(34,211,238,0.55)]">
                  {activeNavItem.icon}
                </span>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">章节状态</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold tracking-[0.01em] text-white">{activeNavItem.label}</p>
                    <span className="rounded-full border border-cyan-400/16 bg-cyan-400/[0.06] px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-100">
                      Route {routeProgress}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[auto_auto] lg:min-w-[26rem]">
                <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">导航方式</p>
                  <p className="mt-1 text-sm text-slate-200">滚动页面或点击左侧战术面板切换模块。</p>
                </div>
                <div className="rounded-[18px] border border-white/8 bg-[linear-gradient(135deg,rgba(10,18,31,0.88),rgba(7,12,22,0.92))] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">当前判断主线</p>
                  <p className="mt-1 text-sm text-slate-200">{activeScenario.stage} · {activeStrategy.name} · 步骤 0{activeWorkflowIndex + 1}</p>
                </div>
              </div>
            </div>
          </section>

          <section id="overview" tabIndex={-1} className="scroll-mt-32 space-y-5 sm:scroll-mt-24">
            <div className="panel-surface-strong relative overflow-hidden rounded-[32px] border px-5 py-5 sm:px-7 sm:py-6 xl:px-8 xl:py-7">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015),transparent)]" />
              <div className="panel-shell-fade-hero" />
              <div className="pointer-events-none absolute right-0 top-0 h-full w-[32rem] bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.12),transparent_58%)]" />

              <div className="panel-shell-content flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-4xl space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-slate-400">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Option Guidance 2.0</span>
                    <span className={`rounded-full border px-3 py-1 ${activeTone.badge}`}>独立作战终端</span>
                    <span className="rounded-full border border-amber-400/20 bg-amber-500/8 px-3 py-1 text-amber-100">首版演示数据</span>
                  </div>
                  <div className="space-y-3">
                    <h1 className="max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl xl:text-[3.6rem]">
                      期权作战终端 2.0
                    </h1>
                    <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                      这里不是把旧首页重做一遍，而是把交易思路压成一张更像作战台的地图：先判断市场剧本，再挑策略角色，然后过一遍风险边界，最后才决定今天是观察、埋伏，还是执行。
                    </p>
                  </div>
                  <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
                    {overviewCards.map((card) => (
                      <div key={card.title} className="metric-tile rounded-[24px] px-4 py-3 transition duration-200 hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.05]">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{card.title}</p>
                        <p className="mt-2 leading-7 text-white">{card.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3 sm:flex-row xl:flex-col">
                  <Link
                    href="/"
                    className="flex h-12 items-center justify-center gap-2 rounded-[20px] border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-white transition hover:border-cyan-300/40 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
                  >
                    <ArrowLeft className="size-4" />
                    返回旧版首页
                  </Link>
                  <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    className="flex h-12 items-center justify-center gap-2 rounded-[20px] border border-cyan-400/20 bg-cyan-500/10 px-4 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
                  >
                    <CircleHelp className="size-4" />
                    这页怎么用
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              {dynamicMetrics.map((metric) => {
                return (
                  <article key={metric.label} className="metric-tile relative overflow-hidden rounded-[28px] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.05]">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015),transparent)]" />
                    <div className="panel-shell-fade-compact" />
                    <p className="panel-shell-content text-[11px] uppercase tracking-[0.28em] text-slate-500">{metric.label}</p>
                    <p className="relative mt-3 text-2xl font-semibold tracking-tight text-white">{metric.value}</p>
                    <p className="relative mt-2 text-sm leading-7 text-slate-300">{metric.note}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <ScenariosSection
            scenarios={scenarios}
            activeScenario={activeScenario}
            activeTone={activeTone}
            activeRoleName={activeStrategy.name}
            onScenarioChange={setActiveScenarioId}
            onRoleSelect={(roleName) => {
              const nextRoleName = roleName.replace(/^轻仓\s+/, "").trim();
              const matchedStrategy = opportunities.find((opportunity) => opportunity.name === nextRoleName);
              if (matchedStrategy) {
                setActiveStrategyName(matchedStrategy.name);
                window.requestAnimationFrame(() => navigateToSection("strategies"));
                return;
              }
              window.requestAnimationFrame(() => navigateToSection("checklist"));
            }}
            getNextIndex={getNextIndex}
            focusRadioAt={focusRadioAt}
            toneClasses={toneClasses}
          />

          <StrategiesSection
            opportunities={opportunities}
            activeStrategy={activeStrategy}
            activeStrategyTone={activeStrategyTone}
            strategyAxes={strategyAxes}
            recommendedRoles={activeScenarioRecommendedRoles}
            suggestedWorkflowLabel={suggestedWorkflowLabel}
            onStrategyChange={setActiveStrategyName}
            onSuggestWorkflow={() => {
              setActiveWorkflowIndex(suggestedWorkflowIndex);
              window.requestAnimationFrame(() => navigateToSection("workflow"));
            }}
            getNextIndex={getNextIndex}
            focusRadioAt={focusRadioAt}
            toneClasses={toneClasses}
            isRoleRecommended={isRoleRecommended}
          />

          <section id="checklist" tabIndex={-1} className="scroll-mt-32 sm:scroll-mt-24">
            <div className="panel-surface rounded-[32px] p-5 sm:p-6">
              <SectionHeader
                eyebrow="决策检查"
                title="开仓前先过这一页，不是每次都非得立刻动手"
                description="你真正需要的往往不是更多指标，而是一个顺序清楚的检查框架：先看什么、别漏什么、最晚在什么时候按暂停。"
              />

              <div className="mt-5 rounded-[24px] border border-cyan-400/14 bg-[linear-gradient(135deg,rgba(34,211,238,0.1),rgba(255,255,255,0.02))] px-4 py-3 text-sm leading-7 text-slate-100">
                当前结论：先按「{activeScenario.stage} → {activeStrategy.name} → 步骤 0{activeWorkflowIndex + 1}」这条线走。如果这三列看完，你还是说不清今天该观察、埋伏还是执行，那就先别动手。
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                <section className="metric-tile rounded-[28px] p-5">
                  <div className="flex items-center gap-2 text-cyan-100">
                    <Radar className="size-4" />
                    <p className="text-sm font-medium">今天先盯什么</p>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                    {contextualWatchlist.map((item, index) => (
                      <li key={item} className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">观察项 0{index + 1}</span>
                        <p className="mt-2 text-slate-200">{item}</p>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="metric-tile rounded-[28px] p-5">
                  <div className="flex items-center gap-2 text-amber-200">
                    <ShieldAlert className="size-4" />
                    <p className="text-sm font-medium">必须拦住自己的点</p>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                    {contextualRiskGates.map((item, index) => (
                      <li key={item} className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">拦截点 0{index + 1}</span>
                        <p className="mt-2 text-slate-200">{item}</p>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="metric-tile rounded-[28px] p-5">
                  <div className="flex items-center gap-2 text-emerald-200">
                    <Target className="size-4" />
                    <p className="text-sm font-medium">推荐顺序</p>
                  </div>
                  <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                    {contextualExecutionSteps.map(({ item, isCurrent }, index) => (
                      <li key={item} className={`flex gap-3 rounded-[18px] border px-4 py-3 ${isCurrent ? "border-emerald-400/18 bg-emerald-400/[0.08] text-slate-100" : "border-white/8 bg-white/[0.03]"}`}>
                        <span className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] ${isCurrent ? "border-emerald-300/26 bg-emerald-400/[0.14] text-emerald-50" : "border-emerald-400/14 bg-emerald-400/[0.06] text-emerald-100"}`}>
                          0{index + 1}
                        </span>
                        <span>
                          {item}
                          {isCurrent ? <span className="mt-1 block text-xs text-emerald-100/85">当前推进：{activeWorkflow.output}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>
            </div>
          </section>

          <WorkflowSection
            workflowSteps={workflowSteps}
            activeWorkflow={activeWorkflow}
            activeWorkflowIndex={activeWorkflowIndex}
            activeWorkflowTone={activeWorkflowTone}
            onWorkflowChange={setActiveWorkflowIndex}
            getNextIndex={getNextIndex}
            focusRadioAt={focusRadioAt}
            toneClasses={toneClasses}
          />

          <section id="mistakes" tabIndex={-1} className="scroll-mt-32 sm:scroll-mt-24">
            <div className="panel-surface rounded-[32px] p-5 sm:p-6">
              <SectionHeader
                eyebrow="常见误判"
                title="很多亏损不是因为看错，而是因为把错策略用在了对行情上"
                description="下面这些坑，几乎都不是知识不够，而是顺序错了、定位错了，或者嘴上说能接受，真到临场又做不到。"
              />

              <div className={`mt-5 rounded-[24px] border px-4 py-3 text-sm leading-7 ${highlightedMistakeTone.badge}`}>
                当前最容易犯的错：{highlightedMistake.title}。因为现在是 {activeScenario.stage}，你又在看 {activeStrategy.name}，最容易忽略的是：{highlightedMistake.reality}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {mistakeCases.map((item) => {
                  const tone = toneClasses(item.tone);
                  return (
                    <article key={item.title} className={`metric-tile rounded-[26px] p-5 ${item.title === highlightedMistake.title ? "border-white/16 shadow-[0_18px_36px_-24px_rgba(34,211,238,0.28)]" : "opacity-88"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                        <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${tone.badge}`}>高频误判</span>
                      </div>
                      <dl className="mt-4 space-y-3 text-sm leading-7">
                        <div>
                          <dt className="text-slate-500">当时脑子里的声音</dt>
                          <dd className="mt-1 text-slate-200">{item.thought}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">真实后果</dt>
                          <dd className="mt-1 text-slate-200">{item.reality}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">更合理的修正</dt>
                          <dd className="mt-1 text-slate-200">{item.correction}</dd>
                        </div>
                      </dl>
                      {item.title === highlightedMistake.title ? (
                        <button
                          type="button"
                          onClick={() => navigateToSection(highlightedMistakeTarget)}
                          className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-100 transition hover:border-white/16 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
                        >
                          回看对应模块
                          <ArrowUpRight className="size-3.5" />
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section id="about" tabIndex={-1} className="scroll-mt-32 pb-[calc(100vh-18rem)] sm:scroll-mt-24 sm:pb-[calc(100vh-16rem)] xl:pb-[calc(100vh-12rem)]">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_0.9fr]">
              <section className="panel-surface rounded-[32px] p-5 sm:p-6">
                <SectionHeader
                  eyebrow="版本说明"
                  title="这一版先把方法论和导航修出来，不急着把实时引擎搬进来"
                  description="2.0 现在的职责，是把市场判断、策略角色、风险顺序和行动路径讲清楚。它不是 1.0 的低配镜像，而是独立试验场。"
                />

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <article className="metric-tile rounded-[24px] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">这一版已经有</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                      <li className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2.5">市场剧本切换与解释</li>
                      <li className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2.5">策略角色地图与对照</li>
                      <li className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2.5">决策检查、作战流程、常见误判</li>
                      <li className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2.5">和 1.0 同级别的页内导航体验</li>
                    </ul>
                  </article>
                  <article className="metric-tile rounded-[24px] p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">这一版还没有</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                      <li className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2.5">1.0 的实时推荐排序</li>
                      <li className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2.5">候选合约表格与详情抽屉</li>
                      <li className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2.5">SWR 驱动的市场数据流</li>
                      <li className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2.5">真实下单前的精细风控参数</li>
                    </ul>
                  </article>
                </div>
              </section>

              <section className="panel-surface rounded-[32px] p-5 sm:p-6">
                <SectionHeader
                  eyebrow="下一步"
                  title="这页接下来可以往哪长"
                  description="如果 1.0 继续扛实时推荐，2.0 最自然的下一阶段，就是把方法论再往真实执行靠近一步。"
                />
                <ol className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
                  {roadmap.map((item, index) => (
                    <li key={item} className="flex gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                      <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-[11px] text-slate-400">
                        0{index + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:border-cyan-300/40 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
                  >
                    去旧版页面继续看实时推荐
                    <ArrowUpRight className="size-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-cyan-400/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
                  >
                    <CircleHelp className="size-4" />
                    再看一次阅读说明
                  </button>
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>

      <Dialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="2.0 页面怎么用"
        subtitle="先判断，再执行"
        size="sm"
      >
        <div className="space-y-4 text-sm leading-7 text-slate-300">
          <p>
            这页最推荐的阅读顺序是：先看“页面总览”，确认这不是 1.0 的替代页；再看“市场剧本”，把今天的市场语气定下来；接着去“策略角色”和“决策检查”，最后再走一遍“作战流程”和“常见误判”。
          </p>
          <p>
            如果你已经准备进入实时筛选、看具体候选合约、打开详情抽屉，那就回到 1.0。2.0 现在更像你的战前会议室：先把脑子理顺，再回去执行。
          </p>
        </div>
      </Dialog>
    </main>
  );
}
