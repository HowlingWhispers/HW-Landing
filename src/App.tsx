import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Projects } from './components/Projects';
import { EcosystemFlow } from './components/EcosystemFlow';
import { Utilities } from './components/Utilities';
import { Community } from './components/Community';
import { Footer } from './components/Footer';

export function App() {
  return (
    <div className="app">
      <Header />
      <main>
        <Hero />
        <Projects />
        <EcosystemFlow />
        <Utilities />
        <Community />
      </main>
      <Footer />
    </div>
  );
}