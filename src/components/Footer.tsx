import { Github, MessageSquare } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-brand">
          <a href="/" className="footer-logo" aria-label="Howling Whispers home">
            <span className="logo-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 2L22 8V16L16 22L10 16V8L16 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M16 6V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10 10H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <span>HOWLING WHISPERS</span>
          </a>
          <p className="footer-tagline">
            A connected ecosystem for interactive worlds, characters, simulation, worldbuilding, and AI-assisted storytelling.
          </p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <div className="footer-column">
            <h4>Projects</h4>
            <ul>
              <li><a href="https://lib.thehowlingwhispers.com/" target="_blank" rel="noopener noreferrer">Orbis Library</a></li>
              <li><a href="https://lib.thehowlingwhispers.com/projects/speculus" target="_blank" rel="noopener noreferrer">Speculus</a></li>
              <li><a href="https://lib.thehowlingwhispers.com/projects/fabula" target="_blank" rel="noopener noreferrer">Fabula</a></li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Community</h4>
            <ul>
              <li>
                <a href="https://discord.gg/K3aMbSeYw2" target="_blank" rel="noopener noreferrer">
                  <MessageSquare size={14} aria-hidden="true" /> Discord
                </a>
              </li>
              <li>
                <a href="https://github.com/HowlingWhispers" target="_blank" rel="noopener noreferrer">
                  <Github size={14} aria-hidden="true" /> GitHub
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="footer-bottom">
        <p>&copy; {currentYear} Howling Whispers. All rights reserved.</p>
        <p className="footer-disclaimer">
          Howling Whispers integrates with NovelAI for AI generation capabilities. 
          We are not owned, endorsed, sponsored, or officially operated by NovelAI.
        </p>
      </div>
    </footer>
  );
}
