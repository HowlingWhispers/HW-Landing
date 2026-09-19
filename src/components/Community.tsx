import { MessageSquare, Github, ExternalLink, Users } from 'lucide-react';

export function Community() {
  return (
    <section id="community" className="community" aria-labelledby="community-title">
      <div className="section-header">
        <h2 id="community-title" className="section-title">Community</h2>
        <p className="section-description">
          Howling Whispers is built in the open with a community of worldbuilders, writers, and developers.
        </p>
      </div>
      <div className="community-grid">
        <article className="community-card community-card--primary">
          <div className="community-icon" aria-hidden="true">
            <MessageSquare size={32} strokeWidth={1.5} />
          </div>
          <h3>Join the Howling Whispers Discord</h3>
          <p>
            The heart of the community. Discuss worldbuilding, share your Orbis creations, test Speculus builds, 
            get verification for adult content access, and talk directly with the developers.
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
            <Users size={14} aria-hidden="true" /> Active community · Verification available · Direct dev access
          </p>
        </article>
        <article className="community-card">
          <div className="community-icon" aria-hidden="true">
            <Github size={32} strokeWidth={1.5} />
          </div>
          <h3>GitHub Organization</h3>
          <p>
            View the public repositories, report issues, contribute code, or follow development across 
            Orbis, Speculus, and related tooling.
          </p>
          <a
            href="https://github.com/HowlingWhispers"
            target="_blank"
            rel="noopener noreferrer"
            className="button button--ghost"
          >
            <span>View on GitHub</span>
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </article>
      </div>
    </section>
  );
}
