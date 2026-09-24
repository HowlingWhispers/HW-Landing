import { ArrowRight, BookOpen, FlaskConical, Terminal } from 'lucide-react';

export function Hero() {
  return (
    <section className="hero welcome-hero" aria-labelledby="hero-title">
      <div className="hero-background" aria-hidden="true">
        <div className="hero-glow glow-1" />
        <div className="hero-glow glow-2" />
        <div className="hero-glow glow-3" />
        <div className="hero-grid" />
        <div className="welcome-orb welcome-orb--one" />
        <div className="welcome-orb welcome-orb--two" />
      </div>

      <div className="welcome-shell">
        <div className="welcome-copy">
          <p className="hero-kicker">WELCOME TO HOWLING WHISPERS</p>

          <h1 id="hero-title" className="hero-title welcome-title">
            <span className="hero-title-main">Every whisper becomes a world.</span>
          </h1>

          <p className="welcome-lead">
            Howling Whispers is an <strong>experimental AI roleplay and worldbuilding project</strong>
            for creating people, places, lore, and stories that can carry context forward.
          </p>

          <p className="welcome-subcopy">
            It is a hobby project under active development. Things may change, break, disappear,
            or be rebuilt while we explore what a more persistent roleplay world can become.
          </p>

          <div className="welcome-status" role="note" aria-label="Project status">
            <FlaskConical size={15} aria-hidden="true" />
            <span><strong>Heavily experimental.</strong> Come in, explore, and expect a few loose floorboards.</span>
          </div>

          <div className="hero-actions welcome-actions">
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
            <a href="#available" className="button button--secondary">
              <span>See what is available</span>
            </a>
          </div>
        </div>

        <aside className="welcome-doors" aria-label="Available Howling Whispers experiences">
          <p className="welcome-doors__eyebrow">OPEN NOW</p>

          <a
            className="welcome-door welcome-door--orbis"
            href="https://lib.thehowlingwhispers.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="welcome-door__icon"><BookOpen size={22} /></span>
            <span className="welcome-door__copy">
              <strong>Orbis</strong>
              <small>Build and explore the world library</small>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </a>

          <a
            className="welcome-door welcome-door--speculus"
            href="https://lib.thehowlingwhispers.com/projects/speculus"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="welcome-door__icon"><Terminal size={22} /></span>
            <span className="welcome-door__copy">
              <strong>Speculus</strong>
              <small>Step into roleplay and simulation</small>
            </span>
            <ArrowRight size={17} aria-hidden="true" />
          </a>

          <p className="welcome-doors__note">
            New here? Start with <strong>Orbis</strong>. It is where worlds, characters, places, and lore live.
          </p>
        </aside>
      </div>

      <div className="welcome-scroll-cue" aria-hidden="true">
        <span>EXPLORE</span>
        <i />
      </div>
    </section>
  );
}
