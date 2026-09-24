import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  FlaskConical,
  Github,
  Layers3,
  MessageCircle,
  Moon,
  Orbit,
  Search,
  Sparkles,
  Sun,
  Terminal,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Page = "welcome" | "projects" | "experiment" | "community" | "archive";
const pages: { id: Page; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "projects", label: "Projects" },
  { id: "experiment", label: "The Experiment" },
  { id: "community", label: "Community" },
  { id: "archive", label: "Archive" },
];
const ORBIS = "https://lib.thehowlingwhispers.com/";
const DISCORD = "https://discord.gg/K3aMbSeYw2";
const GITHUB = "https://github.com/HowlingWhispers";
const readPage = (): Page => {
  const hash = location.hash.slice(1);
  const aliases: Record<string, Page> = {
    top: "welcome",
    available: "projects",
    ecosystem: "experiment",
    legacy: "archive",
    utilities: "projects",
  };
  return pages.find((p) => p.id === hash)?.id ?? aliases[hash] ?? "welcome";
};

type Project = {
  name: string;
  category: "Worlds & roleplay" | "Utilities";
  status: string;
  description: string;
  icon: LucideIcon;
  color: string;
  href?: string;
  action?: string;
};
const projects: Project[] = [
  {
    name: "Orbis",
    category: "Worlds & roleplay",
    status: "Available · Experimental",
    description:
      "Build a world and step into its stories. Orbis brings worldbuilding, roleplay, and the connected systems behind them together in one project.",
    icon: BookOpen,
    color: "sage",
    href: ORBIS,
    action: "Enter Orbis",
  },
  {
    name: "EVE Account Hub",
    category: "Utilities",
    status: "Private · In development",
    description:
      "A separate experiment in EVE Online account tools, markets, assets, and route planning. Not publicly available.",
    icon: Compass,
    color: "blue",
  },
];
function External({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={17} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
function WorldArt() {
  return (
    <div className="world-art" aria-hidden="true">
      <div className="art-halo" />
      <svg className="orbital-art" viewBox="0 0 620 620" fill="none">
        <defs>
          <radialGradient id="sphere" cx="32%" cy="27%" r="75%">
            <stop stopColor="#60877c" />
            <stop offset=".5" stopColor="#243e3c" />
            <stop offset="1" stopColor="#0c191d" />
          </radialGradient>
          <linearGradient id="orbit" x1="0" y1="0" x2="620" y2="620">
            <stop stopColor="#d6c4a0" stopOpacity=".85" />
            <stop offset=".5" stopColor="#aecabf" stopOpacity=".2" />
            <stop offset="1" stopColor="#d6c4a0" stopOpacity=".6" />
          </linearGradient>
          <clipPath id="globe-clip">
            <circle cx="310" cy="310" r="151" />
          </clipPath>
        </defs>
        <g className="orbit-outer">
          <circle
            cx="310"
            cy="310"
            r="270"
            stroke="url(#orbit)"
            strokeDasharray="1 12"
          />
          <circle
            cx="310"
            cy="310"
            r="235"
            stroke="url(#orbit)"
            strokeWidth=".6"
          />
          <path
            d="M310 27v18M310 575v18M27 310h18M575 310h18"
            stroke="#b9c8b9"
          />
          <circle cx="310" cy="75" r="5" fill="#dbc696" />
          <circle cx="310" cy="545" r="3" fill="#acc3ba" />
        </g>
        <ellipse
          cx="310"
          cy="310"
          rx="281"
          ry="110"
          transform="rotate(-32 310 310)"
          stroke="url(#orbit)"
        />
        <circle
          cx="310"
          cy="310"
          r="151"
          fill="url(#sphere)"
          stroke="#97b6a3"
          strokeOpacity=".5"
        />
        <g
          clipPath="url(#globe-clip)"
          stroke="#b2cbb5"
          strokeOpacity=".2"
          strokeWidth=".8"
        >
          {[45, 92, 132].map((r) => (
            <ellipse
              key={r}
              cx="310"
              cy="310"
              rx={r}
              ry="151"
              transform="rotate(-22 310 310)"
            />
          ))}
          {[225, 265, 310, 355, 395].map((y) => (
            <ellipse
              key={y}
              cx="310"
              cy={y}
              rx="156"
              ry="24"
              transform="rotate(-22 310 310)"
            />
          ))}
          <path
            d="M179 236q60 18 65 65t58 10 45 57 81 21M198 225q23-43 76-1t51 7 65 29 28 46M196 339q41-4 43 37t52 21M293 172q15 45 63 31t52 44"
            strokeWidth="1.4"
            strokeOpacity=".55"
          />
        </g>
        <ellipse
          cx="310"
          cy="310"
          rx="207"
          ry="187"
          transform="rotate(34 310 310)"
          stroke="url(#orbit)"
          strokeDasharray="4 8"
        />
        <path d="M72 459Q306 547 544 165" stroke="url(#orbit)" />
        <g fill="#dac79e">
          <circle cx="157" cy="198" r="4" />
          <circle cx="482" cy="417" r="5" />
          <path d="M515 192v14m-7-7h14M114 404v12m-6-6h12" stroke="#dac79e" />
        </g>
      </svg>
      <span className="art-label art-label--top">
        <i /> A LITTLE WORLD OF POSSIBILITIES
      </span>
      <span className="art-label art-label--bottom">
        IMAGINATION, STILL IN ORBIT <span>↗</span>
      </span>
      <span className="art-caption">
        Conceptual illustration · not a playable map
      </span>
    </div>
  );
}
function ProjectCard({
  project,
  number,
}: {
  project: Project;
  number: number;
}) {
  const Icon = project.icon;
  return (
    <article className={`project-card ${project.color}`}>
      <div className="card-top">
        <span className="project-icon">
          <Icon size={23} strokeWidth={1.5} />
        </span>
        <span className="card-number">0{number}</span>
      </div>
      <div className={`status ${project.href ? "available" : ""}`}>
        <i />
        {project.status}
      </div>
      <h3>{project.name}</h3>
      <p>{project.description}</p>
      {project.name === "Orbis" && (
        <div className="project-systems">
          <a href="#experiment" className="text-link">
            How the systems connect <ArrowRight size={16} />
          </a>
        </div>
      )}
      {project.href ? (
        <External href={project.href} className="card-link">
          {project.action}
        </External>
      ) : (
        <span className="not-open">
          On the workbench <Wrench size={14} />
        </span>
      )}
    </article>
  );
}
function Welcome() {
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="tiny-star">✳</span> A HOME FOR CURIOUS MINDS
          </p>
          <h1>
            Every whisper
            <br />
            becomes <em>a world.</em>
          </h1>
          <p className="hero-description">
            Worlds to build. Stories to step into.
            <br className="desktop-break" /> Strange little ideas worth
            exploring.
          </p>
          <p className="hero-detail">
            Welcome to Howling Whispers, an independent home for experimental AI
            roleplay, worldbuilding, and whatever we dream up next.
          </p>
          <div className="actions">
            <External href={ORBIS} className="button primary">
              Explore Orbis
            </External>
            <a href="#projects" className="text-link">
              Find your curiosity <ArrowRight size={17} />
            </a>
          </div>
          <p className="hero-note">
            <span className="live-dot" /> Heavily experimental. Happily in
            progress.
          </p>
        </div>
        <WorldArt />
      </section>
      <div className="intro-strip shell">
        <span>IMAGINE. CREATE. EXPLORE. REPEAT.</span>
        <a href="#projects">
          A growing family of projects <ArrowDown size={15} />
        </a>
      </div>
      <section className="section shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MAKE YOURSELF AT HOME</p>
            <h2>Where will you begin?</h2>
          </div>
          <a href="#projects" className="text-link">
            All projects <ArrowRight size={17} />
          </a>
        </div>
        <div className="project-grid featured">
          {projects
            .filter((p) => p.name === "Orbis")
            .map((p, i) => (
              <ProjectCard key={p.name} project={p} number={i + 1} />
            ))}
        </div>
        <p className="start-note">
          <BookOpen size={16} /> New here? Create or choose a world in Orbis,
          then use <strong>Simulate</strong> to enter Speculus.
        </p>
      </section>
      <section className="invitation shell">
        <span className="invitation-mark" aria-hidden="true">
          ✳
        </span>
        <div>
          <p className="eyebrow">THE BEAUTY IS IN THE BECOMING</p>
          <h2>
            Come for a world.
            <br />
            <em>Stay for the possibilities.</em>
          </h2>
          <p>
            Some ideas grow into tools. Others become stories. This is a place
            to follow that curiosity, together.
          </p>
        </div>
        <a
          href="#experiment"
          className="circle-link"
          aria-label="Explore the experiment"
        >
          <ArrowUpRight size={30} />
        </a>
      </section>
      <section className="experimental-note shell">
        <FlaskConical size={22} />
        <div>
          <h3>A work in progress, in the best sense.</h3>
          <p>
            This is a heavily experimental hobby project. Features can change,
            break, or be rebuilt. Fabula and Studium are still in development.
            Bring your curiosity, and tell us what you find.
          </p>
        </div>
        <a href="#community" className="text-link">
          Join in <ArrowRight size={17} />
        </a>
      </section>
    </>
  );
}
function Projects() {
  const [filter, setFilter] = useState("All projects");
  return (
    <section className="section page-section shell">
      <p className="eyebrow">FOLLOW YOUR CURIOSITY</p>
      <h1>
        A growing family
        <br />
        of <em>possibilities.</em>
      </h1>
      <p className="page-intro">
        Orbis brings our worldbuilding and roleplay systems together as one
        project. There is room alongside it for independent tools, experiments,
        and entirely different adventures.
      </p>
      <div className="filters" aria-label="Filter projects">
        {["All projects", "Worlds & roleplay", "Utilities"].map((f) => (
          <button
            key={f}
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="project-grid">
        {projects
          .filter((p) => filter === "All projects" || p.category === filter)
          .map((p) => (
            <ProjectCard
              key={p.name}
              project={p}
              number={projects.indexOf(p) + 1}
            />
          ))}
      </div>
      <p className="start-note">
        <BookOpen size={16} /> Speculus launches from a world’s Simulate action
        in Orbis.
      </p>
      <div className="quiet-callout">
        <Sparkles size={22} />
        <div>
          <h3>The next idea has room to grow.</h3>
          <p>
            This hub will grow with the projects. No fixed edges, no final
            shape.
          </p>
        </div>
        <a href="#community" className="text-link">
          Bring an idea <ArrowRight size={16} />
        </a>
      </div>
    </section>
  );
}
const stages = [
  {
    name: "Orbis",
    title: "Give the world its roots.",
    text: "Authors shape the people, places, relationships, and canon that make a world its own.",
    icon: BookOpen,
    status: "Available · Experimental",
  },
  {
    name: "Speculus",
    title: "Let a story happen.",
    text: "Bring that context into scenes and roleplay. Explore how characters respond and what happens next.",
    icon: Terminal,
    status: "Available · Experimental",
  },
  {
    name: "Fabula",
    title: "Carry the consequences.",
    text: "The planned runtime gives time, inventory, travel, and events a persistent place beyond the prose.",
    icon: Layers3,
    status: "In development",
  },
  {
    name: "Studium",
    title: "Discover what might belong.",
    text: "Study the history, find patterns, and prepare possible additions for an author to review.",
    icon: Search,
    status: "In development",
  },
];
function Experiment() {
  const [selected, setSelected] = useState(0);
  const stage = stages[selected];
  return (
    <section className="section page-section shell">
      <p className="eyebrow">INSIDE ORBIS</p>
      <h1>
        A story ends.
        <br />
        <em>A world keeps growing.</em>
      </h1>
      <p className="page-intro">
        What if play could enrich the world that made it possible? This is the
        cycle we are working toward, with the author always in control of canon.
      </p>
      <div className="cycle-layout">
        <div className="cycle" aria-label="Explore the proposed world cycle">
          <svg viewBox="0 0 500 500" aria-hidden="true">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="8"
                refX="4"
                refY="4"
                orient="auto"
              >
                <path d="M1 1L6 4L1 7" fill="none" stroke="currentColor" />
              </marker>
            </defs>
            <path
              d="M290 75Q425 75 425 208M425 290Q425 425 292 425M208 425Q75 425 75 292"
              markerEnd="url(#arrowhead)"
            />
            <path
              className="review-path"
              d="M75 208Q75 75 208 75"
              markerEnd="url(#arrowhead)"
              strokeDasharray="5 6"
            />
          </svg>
          <div className="cycle-center">
            <Orbit size={32} strokeWidth={1} />
            <strong>Living Canon</strong>
            <span>THE PROPOSED CYCLE</span>
          </div>
          {stages.map((s, i) => (
            <button
              className={`cycle-node node-${i}`}
              key={s.name}
              onClick={() => setSelected(i)}
              aria-pressed={selected === i}
            >
              <s.icon size={21} />
              <span>{s.name}</span>
              <small>{i < 2 ? "Explore now" : "In development"}</small>
            </button>
          ))}
        </div>
        <div className="cycle-detail" aria-live="polite">
          <span className="eyebrow">
            0{selected + 1} / {stage.name}
          </span>
          <h2>{stage.title}</h2>
          <p>{stage.text}</p>
          <span className="status">
            <i />
            {stage.status}
          </span>
          <div className="review-note">
            <Check size={18} />
            <p>
              <strong>Studium → human review → Orbis</strong>Discoveries are
              proposals. Only reviewed and accepted changes can enrich the
              world’s canon.
            </p>
          </div>
          <button
            className="text-link"
            onClick={() => setSelected((selected + 1) % 4)}
          >
            Explore the next stage <ArrowRight size={17} />
          </button>
        </div>
      </div>
      <div className="quiet-callout">
        <FlaskConical size={25} />
        <div>
          <h3>A direction, not a finished promise.</h3>
          <p>
            Orbis is available, with roleplay through Speculus. The complete
            cycle, including Fabula and Studium, is still being built. Mouseion
            is planned as the creation layer for new world content.
          </p>
        </div>
      </div>
    </section>
  );
}
function Community() {
  return (
    <section className="section page-section shell">
      <p className="eyebrow">THERE IS A SEAT FOR YOU</p>
      <h1>
        Better with
        <br />
        <em>a little company.</em>
      </h1>
      <p className="page-intro">
        Worldbuilders, curious visitors, testers, and people with an idea they
        cannot quite leave alone. You are welcome here.
      </p>
      <div className="community-grid">
        <article className="community-panel">
          <MessageCircle size={36} strokeWidth={1.2} />
          <h2>Pull up a chair.</h2>
          <p>
            Share your worlds, ask questions, report a loose floorboard, or see
            what we are trying next.
          </p>
          <External href={DISCORD} className="button primary">
            Join our Discord
          </External>
          <span className="panel-footnote">
            Worldbuilding · Feedback · Good company
          </span>
        </article>
        <article className="community-panel">
          <Github size={36} strokeWidth={1.2} />
          <h2>Look under the hood.</h2>
          <p>
            Explore the repositories and follow the experiments as they take
            shape. The unfinished parts are part of the story.
          </p>
          <External href={GITHUB} className="button secondary">
            Explore GitHub
          </External>
          <span className="panel-footnote">
            Independent · Hobby-built · Experimental
          </span>
        </article>
      </div>
    </section>
  );
}
function Archive() {
  return (
    <section className="section page-section shell">
      <p className="eyebrow">EVERY PROJECT HAS A FIRST CHAPTER</p>
      <h1>
        Where the
        <br />
        <em>whispers began.</em>
      </h1>
      <p className="page-intro">
        Earlier experiments deserve a place on the shelf. Keep the history,
        learn from it, and make something new.
      </p>
      <article className="archive-panel">
        <span className="eyebrow">01 / THE ORIGINAL ROLEPLAY APP</span>
        <h2>Howling Whispers Legacy</h2>
        <p>
          The original all-in-one roleplay application is preserved for history
          and reference. Its continuing roleplay line now carries the name
          Chatty.
        </p>
        <div className="actions">
          <External
            href="https://sandbox.thehowlingwhispers.com/"
            className="button secondary"
          >
            Open Chatty
          </External>
          <External href={`${GITHUB}/HW-Chatty`} className="text-link">
            View source
          </External>
        </div>
        <span className="panel-footnote">
          Historical reference · Separate from the current worldbuilding tools
        </span>
      </article>
    </section>
  );
}
export function App() {
  const [page, setPage] = useState<Page>(readPage);
  const [light, setLight] = useState(
    () => document.documentElement.dataset.theme === "light",
  );
  useEffect(() => {
    const change = () => {
      setPage(readPage());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title = `Howling Whispers | ${pages.find((p) => p.id === page)?.label}`;
  }, [page]);
  function toggleTheme() {
    const next = !light;
    setLight(next);
    document.documentElement.dataset.theme = next ? "light" : "dark";
    document.documentElement.style.colorScheme = next ? "light" : "dark";
    try {
      localStorage.setItem("hw.theme", next ? "light" : "dark");
    } catch {
      /* Theme remains usable without storage. */
    }
  }
  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="header">
        <div className="header-inner shell">
          <a
            className="brand"
            href="#welcome"
            aria-label="Howling Whispers home"
          >
            <span className="brand-symbol" aria-hidden="true">
              ✳
            </span>
            <span>
              HOWLING
              <br />
              WHISPERS<span className="brand-period">.</span>
            </span>
          </a>
          <nav className="hub-nav" aria-label="Main navigation">
            {pages.map((p) => (
              <a
                key={p.id}
                href={`#${p.id}`}
                aria-current={page === p.id ? "page" : undefined}
              >
                {p.label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${light ? "dark" : "light"} theme`}
            >
              {light ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <External href={ORBIS} className="header-enter">
              Enter Orbis
            </External>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} key={page} className="page-enter">
        {page === "welcome" ? (
          <Welcome />
        ) : page === "projects" ? (
          <Projects />
        ) : page === "experiment" ? (
          <Experiment />
        ) : page === "community" ? (
          <Community />
        ) : (
          <Archive />
        )}
      </main>
      <footer className="footer shell">
        <div className="footer-top">
          <a href="#welcome" className="footer-title">
            Howling Whispers<span>✳</span>
          </a>
          <p>
            A home for worlds, experiments,
            <br />
            and things yet to be imagined.
          </p>
          <div>
            <External href={DISCORD}>Discord</External>
            <External href={GITHUB}>GitHub</External>
            <a href="#archive">
              Archive <ChevronRight size={15} />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Howling Whispers</span>
          <span>Independent. Experimental. Always becoming.</span>
        </div>
        <p className="disclaimer">
          Some tools use third-party AI providers, including NovelAI. Howling
          Whispers is not affiliated with or endorsed by NovelAI or Anlatan.
        </p>
      </footer>
    </div>
  );
}
