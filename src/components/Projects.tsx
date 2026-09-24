import type { CSSProperties } from 'react';
import { ArrowRight, BookOpen, Box, Search, Terminal } from 'lucide-react';

const availableProjects = [
  {
    id: 'orbis',
    name: 'Orbis',
    tagline: 'World Library',
    description:
      'Create and organize worlds, characters, places, items, factions, species, societies, families, memories, and the relationships between them.',
    icon: BookOpen,
    accent: 'var(--accent-orbis)',
    action: { label: 'Enter Orbis', href: 'https://lib.thehowlingwhispers.com/' },
    status: 'Available',
  },
  {
    id: 'speculus',
    name: 'Speculus',
    tagline: 'Roleplay & Simulation',
    description:
      'Enter scenes using Orbis context and experiment with characters, relationships, locations, generation behavior, and evolving simulation tools.',
    icon: Terminal,
    accent: 'var(--accent-speculus)',
    action: { label: 'Open Speculus', href: 'https://lib.thehowlingwhispers.com/projects/speculus' },
    status: 'Available · Experimental',
  },
];

const futureProjects = [
  {
    id: 'fabula',
    name: 'Fabula',
    tagline: 'Persistent World Runtime',
    description:
      'The planned runtime layer for travel, time, inventory, economy, encounters, dice, consequences, and persistent world state.',
    icon: Box,
    accent: 'var(--accent-fabula)',
    status: 'In Development',
  },
  {
    id: 'studium',
    name: 'Studium',
    tagline: 'Research & Living Canon',
    description:
      'Research infrastructure that studies simulation history and prepares possible canon additions for review instead of silently rewriting a world.',
    icon: Search,
    accent: 'var(--accent-studium)',
    status: 'Research · In Development',
  },
];

export function Projects() {
  return (
    <section id="projects" className="projects welcome-projects" aria-labelledby="projects-title">
      <div id="available" className="section-header">
        <p className="section-kicker">WHERE TO START</p>
        <h2 id="projects-title" className="section-title">Two doors are open.</h2>
        <p className="section-description">
          You do not need to understand the whole Howling Whispers ecosystem before using it.
          Start by building a world in Orbis, then step into it through Speculus.
        </p>
      </div>

      <div className="projects-grid projects-grid--available">
        {availableProjects.map((project) => (
          <article
            key={project.id}
            className="project-card project-card--available"
            style={{ '--project-accent': project.accent } as CSSProperties}
          >
            <div className="project-card__statusline">
              <span className="availability-dot" aria-hidden="true" />
              <span>{project.status}</span>
            </div>

            <div className="project-header">
              <div className="project-icon" aria-hidden="true">
                <project.icon size={28} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="project-name">{project.name}</h3>
                <p className="project-tagline">{project.tagline}</p>
              </div>
            </div>

            <p className="project-description">{project.description}</p>

            <div className="project-actions">
              <a
                href={project.action.href}
                target="_blank"
                rel="noopener noreferrer"
                className="button button--primary"
              >
                <span>{project.action.label}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="future-projects">
        <div className="future-projects__intro">
          <p className="section-kicker">STILL ON THE WORKBENCH</p>
          <h3>What we are building toward.</h3>
          <p>
            These are real parts of the project, but they are not presented as public, ready-to-use systems yet.
          </p>
        </div>

        <div className="future-projects__grid">
          {futureProjects.map((project) => (
            <article
              key={project.id}
              className="future-project"
              style={{ '--project-accent': project.accent } as CSSProperties}
            >
              <project.icon size={20} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <div className="future-project__heading">
                  <h4>{project.name}</h4>
                  <span>{project.status}</span>
                </div>
                <p className="future-project__tagline">{project.tagline}</p>
                <p>{project.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
