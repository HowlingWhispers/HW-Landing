import { ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-background" aria-hidden="true">
        <div className="hero-glow glow-1" />
        <div className="hero-glow glow-2" />
        <div className="hero-glow glow-3" />
        <div className="hero-grid" />
      </div>
      <div className="hero-content">
        <h1 id="hero-title" className="hero-title">
          <span className="hero-title-main">Howling Whispers</span>
          <span className="hero-title-tagline">Worlds imagined. Characters remembered. Stories set in motion.</span>
        </h1>
        <p className="hero-description">
          Howling Whispers is a connected ecosystem of tools for building, preserving, exploring, and simulating 
          fictional worlds and characters. From the central library of Orbis to the simulation engine of Speculus, 
          every layer works together to bring your stories to life — with <strong>NovelAI integration</strong> 
          powering AI-assisted roleplay and generation where it matters most.
        </p>
        <div className="hero-actions">
          <a 
            href="https://lib.thehowlingwhispers.com/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="button button--primary"
          >
            <span>Explore Orbis</span>
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a 
            href="https://discord.gg/K3aMbSeYw2" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="button button--secondary"
          >
            <span>Join Discord</span>
          </a>
        </div>
      </div>
    </section>
  );
}