import type { CSSProperties } from 'react';
import { ArrowRight, BookOpen, Box, Search, Terminal } from 'lucide-react';

const projects = [
  {
    id: 'orbis',
    name: 'Orbis',
    tagline: 'Canon & Library',
    description:
      'The canonical library and worldbuilding platform for Howling Whispers. Orbis stores worlds, characters, places, items, factions, species, societies, families, memories, and the relationships that connect them.',
    icon: BookOpen,
    accent: 'var(--accent-orbis)',
    primaryButton: { label: 'Enter Orbis', href: 'https://lib.thehowlingwhispers.com/' },
    status: 'Live · Public Library',
  },
  {
    id: 'speculus',
    name: 'Speculus',
    tagline: 'Simulation Workstation',
    description:
      'An AI roleplay and simulation environment that loads Orbis canon to test characters, scenes, relationships, location context, generation behavior, and evolving simulation systems.',
    icon: Terminal,
    accent: 'var(--accent-speculus)',
    primaryButton: { label: 'View Speculus', href: 'https://lib.thehowlingwhispers.com/projects/speculus' },
    status: 'Active Testing',
  },
  {
    id: 'fabula',
    name: 'Fabula',
    tagline: 'Persistent World Runtime',
    description:
      'The runtime layer for long-running interactive worlds. Fabula is where travel, time, inventory, economy, jobs, encounters, dice, consequences, and persistent player and world state come together.',
    icon: Box,
    accent: 'var(--accent-fabula)',
    primaryButton: { label: 'View Fabula', href: 'https://lib.thehowlingwhispers.com/projects/fabula' },
    status: 'In Development',
  },
  {
    id: 'studium',
    name: 'Studium',
    tagline: 'Research & Analysis',
    description:
      'The research and analysis system for Howling Whispers. Studium studies simulation and runtime history, identifies patterns and gaps, and can prepare proposals for new canon to be reviewed before it returns to Orbis.',
    icon: Search,
    accent: 'var(--accent-studium)',
    primaryButton: { label: 'View Studium', href: 'https://github.com/HowlingWhispers/HW-Studium' },
    status: 'Research Foundation',
  },
];

export function Projects() {
  return (
    <section id="projects" className="projects" aria-labelledby="projects-title">
      <div className="section-header">
        <p className="section-kicker">THE CORE PROJECTS</p>
        <h2 id="projects-title" className="section-title">Four systems. One shared world.</h2>
        <p className="section-description">
          Each project has a different job. Together they move a world from authored canon to simulation,
          persistent play, and research without turning everything into one monolithic application.
        </p>
      </div>

      <div className="projects-grid">
        {projects.map((project) => (
          <article
            key={project.id}
            className="project-card"
            style={{ '--project-accent': project.accent } as CSSProperties}
          >
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
            <p className="project-status">{project.status}</p>

            <div className="project-actions">
              <a
                href={project.primaryButton.href}
                target="_blank"
                rel="noopener noreferrer"
                className="button button--primary"
              >
                <span>{project.primaryButton.label}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
