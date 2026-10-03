import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import documents from "./public-documents.json";
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
  Music,
  FileText,
  ArrowUpRight,
  PawPrint,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Page =
  | "welcome"
  | "projects"
  | "documentation"
  | "creations"
  | "experiment"
  | "community"
  | "archive";
const pages: { id: Page; label: string }[] = [
  { id: "welcome", label: "Home" },
  { id: "projects", label: "Projects" },
  { id: "documentation", label: "Docs" },
  { id: "creations", label: "Creations" },
  { id: "experiment", label: "Experiments" },
  { id: "community", label: "Community" },
  { id: "archive", label: "Archive" },
];
const ORBIS = "https://lib.thehowlingwhispers.com/";
const DISCORD = "https://discord.gg/Q7RQCmFZ8Y";
const GITHUB = "https://github.com/HowlingWhispers";
function readPage(): Page {
  const h = location.hash.slice(1).split("/")[0];
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
  repo?: string;
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
    name: "Coda",
    tag: "Community companion",
    status: "Discord bot",
    description:
      "The clipboard-carrying canine in our community: conversations, worldbuilding help and creative experiments.",
    icon: PawPrint,
    color: "cyan",
    href: DISCORD,
    action: "Meet Coda on Discord",
  },
  {
    name: "Chatty",
    tag: "Private roleplay",
    status: "Private project",
    description:
      "Character-driven conversations and local stories. The original roleplay line continues as its own project.",
    icon: MessageCircle,
    color: "violet",
  },
  {
    name: "Mouseion",
    tag: "Creation",
    status: "Planned",
    description:
      "A proposed creation layer for new world assets. Its place in the ecosystem is still being designed.",
    icon: Sparkles,
    color: "cyan",
  },
  {
    name: "Mens",
    tag: "Research direction",
    status: "Reserved / private",
    description:
      "A reserved project within Howling Whispers. Public features and documentation have not been announced.",
    icon: FlaskConical,
    color: "violet",
  },

  {
    name: "HW Landing",
    tag: "Discovery",
    status: "Project hub",
    description:
      "You are here. Discover the software, documentation, prototypes and creative work across Howling Whispers.",
    icon: Compass,
    color: "cyan",
    repo: "HW-Landing",
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
        {p.repo && (
          <Link href={`${GITHUB}/${p.repo}`} className="source-link">
            <Github size={18} />
            <span className="sr-only">{p.name} source repository</span>
          </Link>
        )}
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
const destinations = [
  {
    title: "Find your next project",
    label: "SOFTWARE & SYSTEMS",
    text: "Worldbuilding, roleplay, research, game tools and the smaller experiments between them.",
    href: "#projects",
    icon: Compass,
  },
  {
    title: "Open the notebooks",
    label: "DOCUMENTATION",
    text: "Read the actual guides, architecture notes and development plans behind the projects.",
    href: "#documentation",
    icon: FileText,
  },
  {
    title: "See what we make",
    label: "MUSIC & STORIES",
    text: "A place for our music, worlds, artwork and narrative experiments.",
    href: "#creations",
    icon: Music,
  },
];
function Home() {
  return (
    <>
      <section className="hero shell coda-hero">
        <div className="hero-copy">
          <p className="eyebrow">WELCOME TO HOWLING WHISPERS</p>
          <h1>
            A little curiosity.
            <br />
            <em>A whole lot of possibility.</em>
          </h1>
          <p className="hero-description">
            Software, stories, music, worlds.
            <br />
            Come find the strange thing we’re building next.
          </p>
          <div className="actions">
            <a href="#projects" className="button primary">
              Explore the projects <ArrowUpRight size={18} />
            </a>
            <a href="#documentation" className="button secondary">
              Read the notebooks
            </a>
          </div>
          <p className="coda-note">
            <PawPrint size={19} /> “Bring your ideas. I brought the clipboard.”{" "}
            <span>— Coda</span>
          </p>
        </div>
        <figure className="coda-art">
          <img
            src="/art/coda-workshop.webp"
            alt="Coda, a white and pale blue canine beastfolk, welcomes you to a creative workshop with her clipboard."
            width="1536"
            height="1024"
            fetchPriority="high"
          />
          <figcaption>
            <span>YOUR HOST</span> Coda <PawPrint size={16} />
          </figcaption>
        </figure>
      </section>
      <div className="discovery-strip shell">
        <span>
          <strong>{projects.length}</strong> project directions
        </span>
        <span>
          <strong>{documents.length}</strong> public documents
        </span>
        <span>
          <strong>One</strong> curious community
        </span>
      </div>
      <section className="section shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PICK A THREAD</p>
            <h2>Where shall we wander?</h2>
          </div>
          <span className="section-number">CODA’S DIRECTORY / 01</span>
        </div>
        <div className="destination-grid">
          {destinations.map((d) => (
            <a className="destination" href={d.href} key={d.title}>
              <d.icon size={29} />
              <span className="eyebrow">{d.label}</span>
              <h3>{d.title}</h3>
              <p>{d.text}</p>
              <span className="text-link">
                Take a look <ArrowUpRight size={17} />
              </span>
            </a>
          ))}
        </div>
      </section>
      <section className="section shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ON THE WORKBENCH</p>
            <h2>Different projects. Shared curiosity.</h2>
          </div>
          <a className="text-link" href="#projects">
            All projects <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="project-grid">
          {[projects[3], projects[4], projects[5]].map((p) => (
            <Card key={p.name} p={p} />
          ))}
        </div>
      </section>
      <section className="section shell notebook-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">OPEN NOTEBOOKS</p>
            <h2>Go beyond the introduction.</h2>
          </div>
          <a href="#documentation" className="text-link">
            Browse documentation <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="notebook-grid">
          {documents
            .filter((d) => d.category === "Architecture")
            .slice(0, 3)
            .map((d) => (
              <a
                className="notebook"
                key={d.id}
                href={`#documentation/${d.id}`}
              >
                <FileText size={25} />
                <span className="eyebrow">
                  {d.project} / {d.category}
                </span>
                <h3>{d.title}</h3>
                <span className="text-link">
                  Read the document <ArrowUpRight size={17} />
                </span>
              </a>
            ))}
        </div>
      </section>
      <section className="community-banner shell">
        <div>
          <p className="eyebrow">THE DEN IS OPEN</p>
          <h2>Good ideas need company.</h2>
          <p>
            Developers, storytellers, artists and curious passersby. Pull up a
            chair.
          </p>
        </div>
        <Link href={DISCORD} className="button primary">
          Join the community <PawPrint size={18} />
        </Link>
      </section>
    </>
  );
}
function Documentation() {
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("All projects");
  const [active, setActive] = useState(() => location.hash.split("/")[1] || "");
  useEffect(() => {
    const change = () => setActive(location.hash.split("/")[1] || "");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const visible = documents.filter(
    (d) =>
      (project === "All projects" || d.project === project) &&
      `${d.title} ${d.project} ${d.category} ${d.body}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selected = documents.find((d) => d.id === active);
  function docUrl(href: string) {
    if (!selected) return "";
    if (/^https?:/i.test(href)) return href;
    if (href.startsWith("#")) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return "";
    return new URL(href, selected.source).href;
  }
  return (
    <section className="section shell page-section">
      <p className="eyebrow">THE HOWLING WHISPERS NOTEBOOKS</p>
      <h1>
        Ideas, explained.
        <br />
        <em>Work, documented.</em>
      </h1>
      <p className="page-intro">
        Public guides and design documents from across the projects. Read them
        here, or follow the source to GitHub.
      </p>
      {selected ? (
        <article className="document-reader">
          <a href="#documentation" className="text-link">
            ← All documents
          </a>
          <div className="reader-header">
            <div>
              <span className="eyebrow">
                {selected.project} / {selected.category}
              </span>
              <h2>{selected.title}</h2>
            </div>
            <Link className="button secondary" href={selected.source}>
              View source <ArrowUpRight size={17} />
            </Link>
          </div>
          <p className="document-meta">
            Snapshot captured {selected.captured} · Source revision{" "}
            {selected.sha.slice(0, 7)} · May differ from current code.
          </p>
          <div className="markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              urlTransform={docUrl}
              components={{
                a: ({ href, children }) =>
                  href ? (
                    <Link href={href}>{children}</Link>
                  ) : (
                    <span>{children}</span>
                  ),
                img: ({ alt }) => <span>{alt}</span>,
              }}
            >
              {selected.body}
            </ReactMarkdown>
          </div>
        </article>
      ) : (
        <>
          <div className="catalog-tools">
            <label className="doc-project">
              <span className="sr-only">Filter documentation by project</span>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                {[
                  "All projects",
                  ...new Set(documents.map((d) => d.project)),
                ].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="project-search">
              <Search size={18} />
              <span className="sr-only">Search documentation</span>
              <input
                type="search"
                placeholder="Search the notebooks…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <p className="result-count" aria-live="polite">
            {visible.length} documents
          </p>
          <div className="notebook-grid">
            {visible.map((d) => (
              <a
                className="notebook"
                key={d.id}
                href={`#documentation/${d.id}`}
              >
                <FileText size={25} />
                <span className="eyebrow">
                  {d.project} / {d.category}
                </span>
                <h3>{d.title}</h3>
                <p>{d.path}</p>
                <span className="text-link">
                  Read document <ArrowUpRight size={17} />
                </span>
              </a>
            ))}
          </div>
          {!visible.length && (
            <div className="empty">
              <h3>No documents found.</h3>
              <button
                className="button secondary"
                onClick={() => {
                  setQuery("");
                  setProject("All projects");
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
function Creations() {
  return (
    <section className="section shell page-section">
      <p className="eyebrow">BEYOND THE CODE</p>
      <h1>
        Made with imagination.
        <br />
        <em>Shared with you.</em>
      </h1>
      <p className="page-intro">
        Music, worldbuilding and experimental storytelling are part of Howling
        Whispers too.
      </p>
      <div className="creation-grid">
        <article className="creation-feature">
          <Music size={35} />
          <span className="eyebrow">THE HOWLING WHISPERS SOUNDTRACK</span>
          <h2>Listen to our other side.</h2>
          <p>
            Visit the official channel for music, artwork and the worlds behind
            them.
          </p>
          <Link
            href="https://www.youtube.com/@HowlingWhispersOfficial"
            className="button primary"
          >
            Open the music channel <ArrowUpRight size={18} />
          </Link>
        </article>
        <article className="creation-feature blue">
          <Compass size={35} />
          <span className="eyebrow">STORIES & EXPERIMENTS</span>
          <h2>Vesper Hollow: Bellflame</h2>
          <p>
            A cold valley, a living flame, and a roll decided before the
            narration. Explore the narrative proof of concept.
          </p>
          <Link
            href="https://thehowlingwhispers.com/vesper"
            className="button secondary"
          >
            Explore Bellflame <ArrowUpRight size={18} />
          </Link>
        </article>
      </div>
      <div className="notice">
        <PawPrint size={25} />
        <p>
          <strong>Bring something of your own.</strong> Share music, art,
          stories or a project in the community. We’re building this collection
          together.
        </p>
      </div>
    </section>
  );
}
function Experiments() {
  return (
    <section className="section shell page-section">
      <p className="eyebrow">CODA’S EXPERIMENT SHELF</p>
      <h1>
        Try something curious.
        <br />
        <em>See what happens.</em>
      </h1>
      <p className="page-intro">
        Small experiences, prototypes and ideas we’re testing. Step inside,
        explore, and tell us what you discover.
      </p>
      <div className="creation-grid">
        <article className="creation-feature blue">
          <PawPrint size={35} />
          <span className="eyebrow">CONVERSATION / SHARED ROOMS</span>
          <h2>Coda’s Den</h2>
          <p>
            A dedicated space to talk with Coda. Create a conversation, invite a
            friend, and explore what a shared AI chatroom can become.
          </p>
          <p>
            Discord sign-in required. Conversations are restricted to room
            members.
          </p>
          <a href="/coda" className="button primary">
            Enter Coda’s Den <ArrowUpRight size={18} />
          </a>
        </article>
        <article className="creation-feature">
          <FlaskConical size={35} />
          <span className="eyebrow">NARRATIVE / RESOLVED OUTCOMES</span>
          <h2>Vesper Hollow: Bellflame</h2>
          <p>
            A cold valley, a living flame, and a roll decided before anyone
            narrated it. A proof of concept for stories built around resolved
            outcomes.
          </p>
          <a href="/vesper" className="button secondary">
            Explore Bellflame <ArrowUpRight size={18} />
          </a>
        </article>
      </div>
      <div className="notice">
        <Wrench size={25} />
        <p>
          <strong>These ideas are still taking shape.</strong> Share feedback,
          unexpected behavior or your next experiment with the community.
        </p>
      </div>
      <div className="actions">
        <Link href={DISCORD} className="button secondary">
          Discuss an experiment
        </Link>
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
              Every direction in Howling Whispers: creative tools, research,
              private projects and experiments. Some are ready to try; others
              are still taking shape.
            </p>
            <Catalog />
          </section>
        ) : page === "documentation" ? (
          <Documentation />
        ) : page === "creations" ? (
          <Creations />
        ) : page === "experiment" ? (
          <Experiments />
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
