import { ArrowRight, BookOpen } from 'lucide-react';

const systems = [
  ['01', 'Orbis', 'Canon & Library'],
  ['02', 'Speculus', 'Simulation'],
  ['03', 'Fabula', 'Persistent Runtime'],
  ['04', 'Studium', 'Research & Analysis'],
];

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-background" aria-hidden="true">
        <div className="hero-glow glow-1" />
        <div className="hero-glow glow-2" />
        <div className="hero-glow glow-3" />
        <div className="hero-grid" />
      </div>

      <div className="hero-content hero-content--split">
        <div className="hero-copy">
          <p className="hero-kicker">WELCOME TO HOWLING WHISPERS</p>
          <h1 id="hero-title" className="hero-title">
            <span className="hero-title-main">Howling Whispers</span>
            <span className="hero-title-tagline">Build worlds that remember.</span>
          </h1>

          <p className="hero-description">
            A connected ecosystem for worldbuilding, character simulation, persistent interactive worlds, and research.
            Orbis preserves the canon. Speculus tests characters and scenes. Fabula carries consequences forward.
            Studium studies what the system produces.
          </p>

          <div className="hero-actions">
            <a
              href="https://lib.thehowlingwhispers.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="button button--primary"
            >
              <BookOpen size={16} aria-hidden="true" />
              <span>Enter Orbis</span>
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a href="#ecosystem" className="button button--secondary">
              <span>See how it connects</span>
            </a>
          </div>

          <p className="hero-start-note">
            New here? Start with Orbis. It is the shared source of truth the rest of the ecosystem builds from.
          </p>
        </div>

        <aside className="hero-system-panel" aria-label="Howling Whispers core ecosystem">
          <div className="hero-system-panel__top">
            <span>HW / CORE ECOSYSTEM</span>
            <span className="hero-system-status"><i aria-hidden="true" /> CONNECTED</span>
          </div>

          <div className="hero-system-list">
            {systems.map(([number, name, role]) => (
              <div className="hero-system-row" key={name}>
                <span className="hero-system-number">{number}</span>
                <div>
                  <strong>{name}</strong>
                  <span>{role}</span>
                </div>
                <span className="hero-system-line" aria-hidden="true" />
              </div>
            ))}
          </div>

          <div className="hero-system-footer">
            <span>CANON</span>
            <span>SIMULATION</span>
            <span>STATE</span>
            <span>RESEARCH</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
