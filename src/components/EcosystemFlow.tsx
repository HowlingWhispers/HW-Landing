import type { CSSProperties } from 'react';
import { ArrowRight, BookOpen, Box, Sparkles, Terminal } from 'lucide-react';

const stages = [
  {
    id: 'mouseion',
    name: 'Mouseion',
    tagline: 'Creation & Research',
    description: 'Develops canonical content, systems, worlds, characters, and simulation intelligence frameworks.',
    icon: Sparkles,
    color: 'var(--accent-mouseion)',
  },
  {
    id: 'orbis',
    name: 'Orbis',
    tagline: 'Library & Archive',
    description: 'Stores and organizes canon with versioning, relationships, and structured data for all record types.',
    icon: BookOpen,
    color: 'var(--accent-orbis)',
  },
  {
    id: 'speculus',
    name: 'Speculus',
    tagline: 'Simulation',
    description: 'Renders Orbis records into controlled prose simulations with persistent context and physical state.',
    icon: Terminal,
    color: 'var(--accent-speculus)',
  },
  {
    id: 'fabula',
    name: 'Fabula',
    tagline: 'World Runtime',
    description: 'Turns authored worlds into persistent playable environments with travel, economy, encounters, and state.',
    icon: Box,
    color: 'var(--accent-fabula)',
  },
];

export function EcosystemFlow() {
  return (
    <section className="ecosystem" aria-labelledby="ecosystem-title">
      <div className="section-header">
        <h2 id="ecosystem-title" className="section-title">Ecosystem Flow</h2>
        <p className="section-description">
          Content flows through the ecosystem from creation to persistent experience. Each layer builds on the last.
        </p>
      </div>
      <div className="flow-container">
        <div className="flow-track">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flow-stage" style={{ '--stage-color': stage.color } as CSSProperties}>
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
      </div>
      <p className="flow-summary">
        <strong>Mouseion</strong> helps create and research. 
        <strong>Orbis</strong> stores and organizes canon. 
        <strong>Speculus</strong> simulates characters and scenes. 
        <strong>Fabula</strong> turns worlds into persistent interactive experiences.
      </p>
    </section>
  );
}
