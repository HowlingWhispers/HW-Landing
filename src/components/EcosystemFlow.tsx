import type { CSSProperties } from 'react';
import { ArrowRight, BookOpen, Box, Search, Terminal } from 'lucide-react';

const stages = [
  {
    id: 'orbis',
    name: 'Orbis',
    tagline: 'Canon & Library',
    description: 'Authors create and maintain the canonical people, places, objects, rules, history, and relationships of a world.',
    icon: BookOpen,
    color: 'var(--accent-orbis)',
  },
  {
    id: 'speculus',
    name: 'Speculus',
    tagline: 'Simulation',
    description: 'Canon is loaded into controlled simulations where characters, scenes, context, and behavior can be tested.',
    icon: Terminal,
    color: 'var(--accent-speculus)',
  },
  {
    id: 'fabula',
    name: 'Fabula',
    tagline: 'Persistent Runtime',
    description: 'Simulation becomes a lasting world with time, travel, inventory, economy, encounters, consequences, and state.',
    icon: Box,
    color: 'var(--accent-fabula)',
  },
  {
    id: 'studium',
    name: 'Studium',
    tagline: 'Research & Feedback',
    description: 'Runtime and simulation history can be studied for patterns, missing pieces, and possible additions to future canon.',
    icon: Search,
    color: 'var(--accent-studium)',
  },
];

export function EcosystemFlow() {
  return (
    <section id="ecosystem" className="ecosystem" aria-labelledby="ecosystem-title">
      <div className="section-header">
        <p className="section-kicker">HOW IT FITS TOGETHER</p>
        <h2 id="ecosystem-title" className="section-title">A loop, not a pile of separate tools.</h2>
        <p className="section-description">
          The projects are designed to hand information forward while keeping canon, simulation, runtime state, and research as distinct responsibilities.
        </p>
      </div>

      <div className="flow-container">
        <div className="flow-track">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className="flow-stage"
              style={{ '--stage-color': stage.color } as CSSProperties}
            >
              <div className="flow-node" aria-hidden="true">
                <stage.icon size={20} strokeWidth={2} />
              </div>
              <div className="flow-content">
                <h3 className="flow-name">{stage.name}</h3>
                <p className="flow-tagline">{stage.tagline}</p>
                <p className="flow-description">{stage.description}</p>
              </div>
              {index < stages.length - 1 && (
                <div className="flow-arrow" aria-hidden="true">
                  <ArrowRight size={18} strokeWidth={2} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flow-feedback">
          <span className="flow-feedback__label">FEEDBACK LOOP</span>
          <span>Studium can prepare findings and canon proposals for review, bringing useful discoveries back toward Orbis without silently rewriting the source of truth.</span>
        </div>
      </div>
    </section>
  );
}
