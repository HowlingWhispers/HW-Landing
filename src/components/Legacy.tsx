import { Archive, ExternalLink, MessageCircle } from 'lucide-react';

export function Legacy() {
  return (
    <section id="legacy" className="legacy" aria-labelledby="legacy-title">
      <div className="section-header">
        <p className="section-kicker">LEGACY</p>
        <h2 id="legacy-title" className="section-title">Where Chatty began.</h2>
        <p className="section-description">
          Before the Howling Whispers ecosystem split into focused projects, the original roleplay
          application lived as one larger codebase. That version is preserved as a historical
          reference, while its continuing roleplay line now carries the name Chatty.
        </p>
      </div>

      <article className="legacy-card">
        <div className="legacy-card__icon" aria-hidden="true">
          <Archive size={30} strokeWidth={1.5} />
        </div>

        <div className="legacy-card__copy">
          <div className="legacy-card__meta">
            <span className="legacy-badge">Preserved</span>
            <span className="legacy-successor">
              <MessageCircle size={13} aria-hidden="true" />
              Successor: Chatty
            </span>
          </div>

          <h3>Howling Whispers Legacy</h3>
          <p>
            The original all-in-one roleplay application is kept intact for history, reference,
            and comparison. Active development no longer happens in this legacy repository.
          </p>

          <a
            href="https://github.com/FreakyHydra/HowlingWhispers/tree/dev"
            target="_blank"
            rel="noopener noreferrer"
            className="button button--ghost"
          >
            <span>View legacy source</span>
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
      </article>
    </section>
  );
}
