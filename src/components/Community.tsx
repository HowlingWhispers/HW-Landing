import { ExternalLink, Github, MessageSquare, Users } from 'lucide-react';

export function Community() {
  return (
    <section id="community" className="community" aria-labelledby="community-title">
      <div className="section-header">
        <p className="section-kicker">BUILD WITH US</p>
        <h2 id="community-title" className="section-title">Follow the worlds and the tools behind them.</h2>
        <p className="section-description">
          Howling Whispers is being built in public. The community is where worldbuilding, testing, development feedback, and new ideas meet.
        </p>
      </div>

      <div className="community-grid">
        <article className="community-card community-card--primary">
          <div className="community-icon" aria-hidden="true">
            <MessageSquare size={32} strokeWidth={1.5} />
          </div>
          <h3>Join the Howling Whispers Discord</h3>
          <p>
            Talk worldbuilding, follow active development, share feedback, discuss the ecosystem, and see what is being tested next.
          </p>
          <a
            href="https://discord.gg/K3aMbSeYw2"
            target="_blank"
            rel="noopener noreferrer"
            className="button button--discord"
          >
            <span>Join Discord</span>
            <ExternalLink size={16} aria-hidden="true" />
          </a>
          <p className="community-meta">
            <Users size={14} aria-hidden="true" /> Worldbuilding · Testing · Development
          </p>
        </article>

        <article className="community-card">
          <div className="community-icon" aria-hidden="true">
            <Github size={32} strokeWidth={1.5} />
          </div>
          <h3>Explore the code</h3>
          <p>
            The public GitHub repositories show the technical side of Orbis, Speculus, Fabula, Studium, and the wider Howling Whispers infrastructure.
          </p>
          <a
            href="https://github.com/HowlingWhispers"
            target="_blank"
            rel="noopener noreferrer"
            className="button button--ghost"
          >
            <span>Howling Whispers on GitHub</span>
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </article>
      </div>
    </section>
  );
}
