/*
 * The one place the app touches Thinking Orbs (@yogesharc/thinking-orbs, MIT,
 * pinned at an audited version in package.json). Everything else uses
 * <AgentOrb>, so the library can be swapped or upgraded here alone.
 *
 * The orb draws in currentColor (ink by default — never Pinterest Red, which
 * DESIGN.md reserves for CTAs) and holds still under prefers-reduced-motion.
 */
import { Orb } from "@yogesharc/thinking-orbs";
import { cx } from "@/utils/cx";
import "./AgentOrb.css";

/**
 * What the AI is doing, as an animated orb.
 * state: "base" | "working" | "reasoning" | "searching" | "background" | "retrying" | "compacting" | "waiting"
 * Pass `label` when the orb is the only thing saying what's happening; otherwise it's decorative.
 */
export default function AgentOrb({ state = "base", variant, size = 20, speed = 1, paused = false, label, className }) {
  return (
    <span className={cx("agent-orb", paused && "is-paused", className)} style={{ width: size, height: size }}>
      <Orb state={state} variant={variant} size={size} speed={speed} paused={paused} label={label} />
    </span>
  );
}

/** An orb for one of the backend planners in data/catalog.js. */
export function PlannerOrb({ planner, ...props }) {
  return <AgentOrb state={planner.orb.state} variant={planner.orb.variant} {...props} />;
}
