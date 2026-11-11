// Budget warning bar (Requirement 8.3). A server component: put <BudgetWarning /> once in
// the signed-in layout so it shows on every screen. Renders nothing under budget.
import "server-only";
import { Word } from "../theme/word";
import { budgetWarning } from "./summary";

const usd = (n: number) => `$${n.toFixed(0)}`;

export async function BudgetWarning() {
  const w = await budgetWarning();
  if (!w?.overBudget) return null;
  return (
    <div role="alert" className="rv-budget" style={{ padding: "6px 12px", background: "var(--bad)", color: "#fff", fontSize: 13 }}>
      <Word k="overBudget" />
      {w.forecastUsd !== null && ` · ${usd(w.forecastUsd)} / ${usd(w.budgetUsd)}`}
    </div>
  );
}
