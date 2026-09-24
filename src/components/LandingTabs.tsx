import { Archive, Boxes, FlaskConical, Home, MessageSquare } from 'lucide-react';

const tabs = [
  { label: 'Welcome', href: '#top', icon: Home, active: true },
  { label: 'Projects', href: '#projects', icon: Boxes },
  { label: 'The Experiment', href: '#ecosystem', icon: FlaskConical },
  { label: 'Community', href: '#community', icon: MessageSquare },
  { label: 'Archive', href: '#legacy', icon: Archive },
];

export function LandingTabs() {
  return (
    <nav className="landing-tabs" aria-label="Howling Whispers hub sections">
      <div className="landing-tabs__inner">
        {tabs.map((tab) => (
          <a
            key={tab.label}
            href={tab.href}
            className={'landing-tab ' + (tab.active ? 'landing-tab--active' : '')}
          >
            <tab.icon size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>{tab.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
