import { BookOpen, MessageSquare } from 'lucide-react';

export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <a href="/" className="logo" aria-label="Howling Whispers home">
          <span className="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2L22 8V16L16 22L10 16V8L16 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M16 6V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 10H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </span>
          <span className="logo-text">HOWLING WHISPERS</span>
        </a>

        <nav className="nav" aria-label="Main navigation">
          <a href="#available">Start here</a>
          <a href="#community">Community</a>
          <a href="#ecosystem">The experiment</a>
          <a href="#utilities">Utilities</a>
          <a href="#legacy">Legacy</a>
        </nav>

        <div className="header-actions">
          <a
            href="https://lib.thehowlingwhispers.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="header-orbis-button"
            aria-label="Open the Orbis library"
          >
            <BookOpen size={15} aria-hidden="true" />
            <span>Open Orbis</span>
          </a>
          <a
            href="https://discord.gg/K3aMbSeYw2"
            target="_blank"
            rel="noopener noreferrer"
            className="header-discord-button"
            aria-label="Join the Howling Whispers Discord community"
          >
            <MessageSquare size={16} aria-hidden="true" />
            <span>Discord</span>
          </a>
        </div>
      </div>
    </header>
  );
}
