import type { CSSProperties } from 'react';
import { ArrowRight, BookOpen, Box, ExternalLink, Sparkles, Terminal } from 'lucide-react';

const projects = [
  {
    id: 'orbis',
    name: 'Orbis',
    tagline: 'The Library of Howling Whispers',
    description:
      'Central archive for worlds, characters, places, factions, items, species, societies, families, memories, and related canon. ' +
      'Orbis stores and organizes your creative work with full versioning, relationships, and structured data. ' +
      'Includes <strong>NovelAI integration</strong> for AI-assisted generation where enabled.',
    icon: BookOpen,
    accent: 'var(--accent-orbis)',
    primaryButton: { label: 'Explore Orbis', href: 'https://lib.thehowlingwhispers.com/', external: true },
    secondaryButton: { label: 'View Project Roadmap', href: 'https://lib.thehowlingwhispers.com/projects/speculus', external: true },
  },
  {
    id: 'speculus',
    name: 'Speculus',
    tagline: 'Simulation',
    description:
      'A roleplay and character/world simulation environment connected to content stored in Orbis. ' +
      'Speculus renders Orbis records into controlled prose simulations with persistent context, relationships, and physical state. ' +
      '<strong>NovelAI</strong> is one of its supported AI-generation capabilities.',
    icon: Terminal,
    accent: 'var(--accent-speculus)',
    primaryButton: { label: 'View Speculus Roadmap', href: 'https://lib.thehowlingwhispers.com/projects/speculus', external: true },
    status: 'Working Concept · Active Testing',
  },
  {
    id: 'fabula',
    name: 'Fabula',
    tagline: 'World Runtime',
    description:
      'The future runtime layer where authored worlds become persistent playable environments. ' +
      'Systems for travel, inventory, economy, encounters, consequences, and character/world state. ' +
      'Fabula builds on the Orbis archive and Speculus simulation foundation to create living, shared worlds.',
    icon: Box,
    accent: 'var(--accent-fabula)',
    primaryButton: { label: 'Read Fabula Overview', href: 'https://lib.thehowlingwhispers.com/projects/fabula', external: true },
    status: 'In Development · Not Publicly Usable',
  },
  {
    id: 'mouseion',
    name: 'Mouseion',
    tagline: 'Creation & Research',
    description:
      'The creation and research side of the ecosystem: developing and analyzing canonical content, systems, worlds, characters, ' +
      'and future simulation intelligence. Mouseion feeds Orbis with researched, structured canon and develops the frameworks ' +
      'that power Speculus and Fabula.',
    icon: Sparkles,
    accent: 'var(--accent-mouseion)',
    status: 'Early Development',
  },
];

export function Projects() {
  return (
    <section id="projects" className="projects" aria-labelledby="projects-title">
      <div className="section-header">
        <h2 id="projects-title" className="section-title">Projects</h2>
        <p className="section-description">
          Four interconnected tools. One ecosystem. Each serves a distinct purpose in the lifecycle of a fictional world.
        </p>
      </div>
      <div className="projects-grid">
        {projects.map((project) => (
          <article key={project.id} className="project-card" style={{ '--project-accent': project.accent } as CSSProperties}>
            <div className="project-header">
              <div className="project-icon" aria-hidden="true">
                <project.icon size={28} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="project-name">{project.name}</h3>
                <p className="project-tagline">{project.tagline}</p>
              </div>
            </div>
            <div className="project-description" dangerouslySetInnerHTML={{ __html: project.description }} />
            {project.status && <p className="project-status">{project.status}</p>}
            <div className="project-actions">
              {project.primaryButton && (
                <a
                  href={project.primaryButton.href}
                  target={project.primaryButton.external ? '_blank' : undefined}
                  rel={project.primaryButton.external ? 'noopener noreferrer' : undefined}
                  className="button button--primary"
                >
                  <span>{project.primaryButton.label}</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
              )}
              {project.secondaryButton && (
                <a
                  href={project.secondaryButton.href}
                  target={project.secondaryButton.external ? '_blank' : undefined}
                  rel={project.secondaryButton.external ? 'noopener noreferrer' : undefined}
                  className="button button--ghost"
                >
                  <span>{project.secondaryButton.label}</span>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
