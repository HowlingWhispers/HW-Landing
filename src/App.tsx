import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Projects } from './components/Projects';
import { Community } from './components/Community';
import { EcosystemFlow } from './components/EcosystemFlow';
import { Utilities } from './components/Utilities';
import { Legacy } from './components/Legacy';
import { Footer } from './components/Footer';

export function App() {
  return (
    <div className="app">
      <Header />
      <main>
        <Hero />
        <Projects />
        <Community />
        <EcosystemFlow />
        <Utilities />
        <Legacy />
      </main>
      <Footer />
    </div>
  );
}
