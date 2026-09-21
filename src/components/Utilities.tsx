import {
  ArrowRightLeft,
  Boxes,
  Calculator,
  LockKeyhole,
  Radar,
  Route,
  Sparkles,
  WalletCards,
} from 'lucide-react';

const tools = [
  { label: 'Trade Runs', icon: ArrowRightLeft },
  { label: 'Market Scanner', icon: Radar },
  { label: 'Account', icon: WalletCards },
  { label: 'Assets', icon: Boxes },
  { label: 'Route Planner', icon: Route },
  { label: 'Cargo Calculator', icon: Calculator },
  { label: 'AI Copilot', icon: Sparkles },
];

export function Utilities() {
  return (
    <section id="utilities" className="utilities" aria-labelledby="utilities-title">
      <div className="section-header">
        <p className="section-kicker">UTILITIES</p>
        <h2 id="utilities-title" className="section-title">Small tools around the larger worlds.</h2>
        <p className="section-description">
          Focused utilities can live beside the core Howling Whispers ecosystem without becoming part of
          Orbis, Speculus, Fabula, or Studium.
        </p>
      </div>

      <article className="utility-card utility-card--eve">
        <div className="utility-card__copy">
          <div className="utility-card__meta">
            <span className="utility-badge">Private utility</span>
            <span className="utility-status"><i /> Foundation in development</span>
          </div>

          <h3>EVE Account Hub</h3>
          <p>
            A private EVE Online command center built around official ESI data. It is being designed for
            account status, wallet and assets, market orders, trade-run discovery, route planning, cargo
            optimization, and an optional AI copilot that explains already-calculated opportunities.
          </p>

          <div className="utility-security">
            <LockKeyhole size={15} aria-hidden="true" />
            <span>OAuth tokens stay server-side. The player remains in control of gameplay.</span>
          </div>
        </div>

        <div className="utility-tool-grid" aria-label="Planned EVE Account Hub tools">
          {tools.map((tool) => (
            <div className="utility-tool" key={tool.label}>
              <tool.icon size={17} aria-hidden="true" />
              <span>{tool.label}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
