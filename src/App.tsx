import { useEffect, useState } from "react";
import {
  BookOpen,
  Compass,
  FlaskConical,
  Github,
  Layers3,
  MessageCircle,
  Moon,
  Search,
  Sparkles,
  Sun,
  Terminal,
  Wrench,
  Orbit,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Page = "welcome" | "projects" | "experiment" | "community" | "archive";
const pages: { id: Page; label: string }[] = [
  { id: "welcome", label: "Home" },
  { id: "projects", label: "Explore" },
  { id: "experiment", label: "The ecosystem" },
  { id: "community", label: "Community" },
  { id: "archive", label: "Archive" },
];
const ORBIS = "https://lib.thehowlingwhispers.com/";
const DISCORD = "https://discord.gg/Q7RQCmFZ8Y";
const GITHUB = "https://github.com/HowlingWhispers";
function readPage(): Page {
  const h = location.hash.slice(1);
  const aliases: Record<string, Page> = {
    top: "welcome",
    available: "projects",
    ecosystem: "experiment",
    legacy: "archive",
    utilities: "projects",
  };
  return pages.find((p) => p.id === h)?.id ?? aliases[h] ?? "welcome";
}
type Project = {
  name: string;
  tag: string;
  status: string;
  description: string;
  icon: LucideIcon;
  color: string;
  href?: string;
  action?: string;
  repo: string;
};
const projects: Project[] = [
  {
    name: "Orbis",
    tag: "Worldbuilding",
    status: "Experimental",
    description:
      "Give your world a home. Build connected characters, places, species and lore in one canonical library.",
    icon: BookOpen,
    color: "cyan",
    href: ORBIS,
    action: "Open Orbis",
    repo: "HW-Orbis",
  },
  {
    name: "Speculus",
    tag: "Roleplay",
    status: "Experimental",
    description:
      "Step into a scene with your persona. Explore characters and stories drawn from your Orbis world.",
    icon: Terminal,
    color: "violet",
    href: ORBIS,
    action: "Start through Orbis",
    repo: "HW-Speculus",
  },
  {
    name: "Fabula",
    tag: "Runtime",
    status: "Pre-alpha",
    description:
      "A foundation for private adventures, canonical NPC presence and player contributions to shared history.",
    icon: Layers3,
    color: "orange",
    repo: "HW-Fabula",
  },
  {
    name: "Praxis",
    tag: "Story experiment",
    status: "Prototype",
    description:
      "Authored stories meet freeform play. Explore the experiment in time, fatigue and structured consequences.",
    icon: Compass,
    color: "pink",
    href: "https://praxis.thehowlingwhispers.com/",
    action: "Visit the prototype",
    repo: "HW-Praxis",
  },
  {
    name: "Studium",
    tag: "Research",
    status: "In development",
    description:
      "Study simulation history and prepare evidence-backed worldbuilding proposals for an author to review.",
    icon: Search,
    color: "cyan",
    repo: "HW-Studium",
  },
  {
    name: "EVE Copilot",
    tag: "Utility",
    status: "Private project",
    description:
      "An independent experiment in EVE account tools, market analysis, cargo planning and corporation comms.",
    icon: Orbit,
    color: "violet",
    repo: "HW-EVE-Copilot",
  },
];
function Link({
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
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
function Card({ p }: { p: Project }) {
  const Icon = p.icon;
  return (
    <article className={`project-card ${p.color}`}>
      <div className="card-top">
        <Icon size={27} />
        <span className="status">{p.status}</span>
      </div>
      <span className="eyebrow">{p.tag}</span>
      <h3>{p.name}</h3>
      <p>{p.description}</p>
      <div className="card-bottom">
        {p.href ? (
          <Link className="card-action" href={p.href}>
            {p.action}
          </Link>
        ) : (
          <span className="workbench">
            <Wrench size={15} /> On the workbench
          </span>
        )}
        <Link href={`${GITHUB}/${p.repo}`} className="source-link">
          <Github size={18} />
          <span className="sr-only">{p.name} source repository</span>
        </Link>
      </div>
    </article>
  );
}
function Catalog() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const visible = projects.filter(
    (p) =>
      (filter === "All" || (filter === "Try now" ? !!p.href : !p.href)) &&
      `${p.name} ${p.description} ${p.tag}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="catalog-tools">
        <div className="filters" aria-label="Project availability">
          {["All", "Try now", "In development"].map((f) => (
            <button
              key={f}
              aria-pressed={f === filter}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="project-search">
          <Search size={18} />
          <span className="sr-only">Search projects</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find your next curiosity…"
            type="search"
          />
        </label>
      </div>
      <p className="result-count" aria-live="polite">
        {visible.length} {visible.length === 1 ? "project" : "projects"}
      </p>
      <div className="project-grid">
        {visible.map((p) => (
          <Card key={p.name} p={p} />
        ))}
      </div>
      {!visible.length && (
        <div className="empty">
          <h3>No projects found.</h3>
          <p>Try another search or show all projects.</p>
          <button
            className="button secondary"
            onClick={() => {
              setQ("");
              setFilter("All");
            }}
          >
            Reset filters
          </button>
        </div>
      )}
    </>
  );
}
function Home() {
  const [goal, setGoal] = useState(0);
  const goals = [
    {
      label: "Build a world",
      title: "Start with a place. Give it a story.",
      text: "Open Orbis to create or explore worlds and the people, places and lore within them.",
      action: "Enter the library",
      href: ORBIS,
    },
    {
      label: "Start a story",
      title: "Your persona. A world of possibilities.",
      text: "Choose an asset in Orbis and use Simulate to launch Speculus. Bring your own persona into the scene.",
      action: "Choose a starting point",
      href: ORBIS,
    },
    {
      label: "Join the makers",
      title: "Bring an idea. Find good company.",
      text: "Meet the community on Discord to talk worldbuilding, share experiments and help test what comes next.",
      action: "Join the Discord",
      href: DISCORD,
    },
  ];
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">INDEPENDENT WORLDS / OPEN-ENDED STORIES</p>
          <h1>
            Every whisper
            <br />
            becomes <em>a world.</em>
          </h1>
          <p className="hero-description">
            A home for worldbuilders, storytellers
            <br className="desktop-break" /> and wonderfully strange
            experiments.
          </p>
          <div className="actions">
            <Link href={ORBIS} className="button primary">
              Explore Orbis
            </Link>
            <a href="#projects" className="button secondary">
              Find a project
            </a>
          </div>
          <p className="hero-note">
            <FlaskConical size={16} /> Built with curiosity. Still experimental.
          </p>
        </div>
        <div className="hero-index">
          <div className="index-header">
            <span className="eyebrow">THE HOWLING WHISPERS FIELD NOTES</span>
            <Sparkles size={21} />
          </div>
          <div className="index-number" aria-hidden="true">
            HW<span> / 01</span>
          </div>
          <p className="index-title">
            A world is more
            <br />
            than its <em>first story.</em>
          </p>
          <p>
            Build its foundations. Meet its characters.
            <br />
            Discover what happens next.
          </p>
          <div className="index-bottom">
            <span>WORLD / CHARACTER / STORY</span>
            <a href="#experiment">Explore the connections</a>
          </div>
        </div>
      </section>
      <section className="start-section shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR FIRST CHAPTER</p>
            <h2>What brings you here?</h2>
          </div>
          <span className="section-number">01 / BEGIN</span>
        </div>
        <div className="start-panel">
          <div className="goal-tabs" aria-label="Choose a starting point">
            {goals.map((g, i) => (
              <button
                key={g.label}
                aria-pressed={goal === i}
                onClick={() => setGoal(i)}
              >
                <span>0{i + 1}</span>
                {g.label}
              </button>
            ))}
          </div>
          <div className="goal-detail" aria-live="polite">
            <h3>{goals[goal].title}</h3>
            <p>{goals[goal].text}</p>
            <Link href={goals[goal].href} className="text-link">
              {goals[goal].action}
            </Link>
          </div>
        </div>
      </section>
      <section className="section shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EXPLORE THE WORKBENCH</p>
            <h2>
              Small beginnings.
              <br />
              <em>Growing possibilities.</em>
            </h2>
          </div>
          <span className="section-number">02 / DISCOVER</span>
        </div>
        <Catalog />
      </section>
      <section className="community-banner shell">
        <div>
          <p className="eyebrow">GOOD IDEAS NEED COMPANY</p>
          <h2>Pull up a chair.</h2>
          <p>
            Share a world, test an experiment, or help us chase a loose thread.
          </p>
        </div>
        <Link href={DISCORD} className="button primary">
          Join the community
        </Link>
      </section>
    </>
  );
}
const stages = [
  {
    name: "Orbis",
    icon: BookOpen,
    title: "Build the foundations.",
    text: "The canonical library holds authored worlds, assets, relationships, ownership and revisions.",
    status: "Experimental",
  },
  {
    name: "Speculus",
    icon: Terminal,
    title: "Step into the story.",
    text: "The simulator launches from Orbis and assembles the scene, persona and relevant world context for roleplay.",
    status: "V3 · Experimental",
  },
  {
    name: "Fabula",
    icon: Layers3,
    title: "Make consequences matter.",
    text: "The pre-alpha runtime establishes private world sessions, canonical NPC presence and reviewed player contributions.",
    status: "Pre-alpha",
  },
  {
    name: "Studium",
    icon: Search,
    title: "Learn from what happened.",
    text: "The research backend studies sanitized history and prepares proposals. Authors decide what becomes canon.",
    status: "In development",
  },
];
function Ecosystem() {
  const [selected, setSelected] = useState(0);
  const s = stages[selected];
  return (
    <section className="section shell page-section">
      <p className="eyebrow">THE BIGGER EXPERIMENT</p>
      <h1>
        Stories happen.
        <br />
        <em>Worlds keep growing.</em>
      </h1>
      <p className="page-intro">
        Separate systems, connected by a shared idea: build a world, explore it,
        and learn from the stories it produces.
      </p>
      <div className="ecosystem-tabs">
        {stages.map((s, i) => (
          <button
            key={s.name}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            <s.icon size={24} />
            <span>0{i + 1}</span>
            <strong>{s.name}</strong>
          </button>
        ))}
      </div>
      <article className="ecosystem-detail" aria-live="polite">
        <span className="eyebrow">
          {s.name} / {s.status}
        </span>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
        <Link href={`${GITHUB}/HW-${s.name}`} className="text-link">
          Explore this project
        </Link>
      </article>
      <div className="notice">
        <FlaskConical size={25} />
        <p>
          <strong>The full cycle is still being built.</strong> Studium
          proposals require human review before entering Orbis canon. Praxis is
          a separate story experiment; Mouseion remains a planned creation
          layer.
        </p>
      </div>
    </section>
  );
}
function Community() {
  return (
    <section className="section shell page-section">
      <p className="eyebrow">THE PEOPLE BEHIND THE WHISPERS</p>
      <h1>
        Make something.
        <br />
        <em>Make it together.</em>
      </h1>
      <p className="page-intro">
        Worldbuilders, artists, developers, curious visitors and people who
        enjoy testing unfinished things. There is room for you here.
      </p>
      <div className="community-grid">
        {[
          {
            title: "The community den",
            text: "Talk to the makers, share stories and art, report a bug, or bring your next strange idea.",
            icon: MessageCircle,
            href: DISCORD,
            action: "Join Discord",
          },
          {
            title: "Follow the conversation",
            text: "Visit our Reddit community for worldbuilding, music, creative experiments and project discussions.",
            icon: Compass,
            href: "https://www.reddit.com/r/TheHowlingWhispers/",
            action: "Visit Reddit",
          },
          {
            title: "Look under the hood",
            text: "Explore the public repositories and follow the work as it takes shape.",
            icon: Github,
            href: GITHUB,
            action: "Explore GitHub",
          },
        ].map((x) => (
          <article className="community-panel" key={x.title}>
            <x.icon size={30} />
            <h2>{x.title}</h2>
            <p>{x.text}</p>
            <Link href={x.href} className="button secondary">
              {x.action}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
function Archive() {
  return (
    <section className="section shell page-section">
      <p className="eyebrow">EARLIER CHAPTERS</p>
      <h1>
        Keep the roots.
        <br />
        <em>Grow something new.</em>
      </h1>
      <p className="page-intro">
        The original all-in-one Howling Whispers application grew into Chatty, a
        separate private roleplay project. Its history remains part of the
        ecosystem.
      </p>
      <article className="archive-panel">
        <Terminal size={32} />
        <span className="eyebrow">THE ORIGINAL ROLEPLAY LINE</span>
        <h2>Chatty</h2>
        <p>
          Character-driven conversations, scenes and private local stories.
          Explore its source for current setup and Windows packaging
          instructions.
        </p>
        <div className="actions">
          <Link href={`${GITHUB}/HW-Chatty`} className="button primary">
            Chatty repository
          </Link>
          <Link
            href="https://sandbox.thehowlingwhispers.com/"
            className="button secondary"
          >
            Visit the legacy site
          </Link>
        </div>
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
  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.dataset.theme = next ? "light" : "dark";
    document.documentElement.style.colorScheme = next ? "light" : "dark";
    try {
      localStorage.setItem("hw.theme", next ? "light" : "dark");
    } catch {}
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
            <img src="/favicon.svg" alt="" />
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
          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label={`Switch to ${light ? "dark" : "light"} theme`}
          >
            {light ? <Moon size={19} /> : <Sun size={19} />}
          </button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} key={page}>
        {page === "welcome" ? (
          <Home />
        ) : page === "projects" ? (
          <section className="section shell page-section">
            <p className="eyebrow">THE PROJECT DIRECTORY</p>
            <h1>
              Follow your
              <br />
              <em>curiosity.</em>
            </h1>
            <p className="page-intro">
              Find a world to build, a story to explore, or an experiment to
              follow. Availability is shown on each project.
            </p>
            <Catalog />
          </section>
        ) : page === "experiment" ? (
          <Ecosystem />
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
            Worlds, stories, and whatever
            <br />
            strange thing we build next.
          </p>
          <div className="footer-links">
            <Link href={DISCORD}>Discord</Link>
            <Link href={GITHUB}>GitHub</Link>
            <a href="#archive">Archive</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Howling Whispers</span>
          <span>Independent / Experimental / In progress</span>
        </div>
        <p className="disclaimer">
          Some tools use third-party AI providers, including NovelAI. Howling
          Whispers is not affiliated with or endorsed by NovelAI or Anlatan.
        </p>
      </footer>
    </div>
  );
}
