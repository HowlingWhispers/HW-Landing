import type { CSSProperties } from 'react';
import { ArrowRight, BookOpen, Box, Search, Terminal } from 'lucide-react';

const stages = [
  {
    id: 'orbis',
    name: 'Orbis',
    tagline: 'Canon & Library',
    description: 'Authors create and maintain the people, places, objects, rules, history, and relationships of a world.',
    icon: BookOpen,
    color: 'var(--accent-orbis)',
    state: 'Available',
  },
  {
    id: 'speculus',
    name: 'Speculus',
    tagline: 'Simulation',
    description: 'Canon is brought into roleplay and controlled simulations where characters, scenes, context, and behavior can be explored.',
    icon: Terminal,
    color: 'var(--accent-speculus)',
    state: 'Available',
  },
  {
    id: 'fabula',
    name: 'Fabula',
    tagline: 'Persistent Runtime',
    description: 'The planned runtime carries time, travel, inventory, economy, encounters, consequences, and world state forward.',
    icon: Box,
    color: 'var(--accent-fabula)',
    state: 'In development',
  },
  {
    id: 'studium',
    name: 'Studium',
    tagline: 'Research & Feedback',
    description: 'Research can study simulation history for patterns, gaps, and possible additions that return to Orbis for human review.',
    icon: Search,
    color: 'var(--accent-studium)',
    state: 'In development',
  },
];

export function EcosystemFlow() {
  return (
    <section id="ecosystem" className="ecosystem ecosystem--roadmap" aria-labelledby="ecosystem-title">
      <div className="section-header">
        <p className="section-kicker">THE LONGER EXPERIMENT</p>
        <h2 id="ecosystem-title" className="section-title">Where Howling Whispers is heading.</h2>
        <p className="section-description">
          The full ecosystem is a direction, not a promise that every piece is ready today.
          Orbis and Speculus are the current public-facing systems; Fabula and Studium are still being built.
        </p>
      </div>

      <div className="flow-container">
        <div className="flow-track">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className={'flow-stage ' + (stage.state !== 'Available' ? 'flow-stage--future' : '')}
              style={{ '--stage-color': stage.color } as CSSProperties}
            >
              <div className="flow-node" aria-hidden="true">
                <stage.icon size={20} strokeWidth={2} />
              </div>
              <div className="flow-content">
                <span className="flow-state">{stage.state}</span>
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
          <span className="flow-feedback__label">THE IDEA</span>
          <span>
            A world begins as authored canon, becomes something you can roleplay inside, gains persistent systems,
            and eventually produces discoveries that can be reviewed before anything becomes canon.
          </span>
        </div>
      </div>
    </section>
  );
}
