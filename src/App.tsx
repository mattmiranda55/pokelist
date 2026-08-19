import { useState } from 'react';
import { Heart, Layers, Search } from 'lucide-react';
import { Pokeball } from './components/Pokeball';
import CollectionScreen from './screens/CollectionScreen';
import SearchScreen from './screens/SearchScreen';
import WantsScreen from './screens/WantsScreen';

type Tab = 'collection' | 'search' | 'wants';

const TABS: { id: Tab; label: string; title: string; Icon: typeof Layers }[] = [
  { id: 'collection', label: 'Collection', title: 'POKÉLIST', Icon: Layers },
  { id: 'search', label: 'Search', title: 'POKÉDEX SEARCH', Icon: Search },
  { id: 'wants', label: 'Wants', title: 'WANT LIST', Icon: Heart },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('collection');
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  // Screens read owned/wanted state on mount; bumping this makes them re-read after any change.
  const [dataVersion, setDataVersion] = useState(0);

  const active = TABS.find((t) => t.id === tab)!;
  const changed = () => setDataVersion((v) => v + 1);

  return (
    <div className="app">
      <header className="header">
        <h1 className="header-title">
          <Pokeball size={22} />
          {active.title}
        </h1>
        <div className="header-actions">{tab === 'collection' && headerActions}</div>
      </header>

      <main className="main">
        {tab === 'collection' && (
          <CollectionScreen
            dataVersion={dataVersion}
            onHeaderActions={setHeaderActions}
            onCollectionChanged={changed}
          />
        )}
        {tab === 'search' && (
          <SearchScreen dataVersion={dataVersion} onCollectionChanged={changed} />
        )}
        {tab === 'wants' && (
          <WantsScreen dataVersion={dataVersion} onWantsChanged={changed} />
        )}
      </main>

      <nav className="tabbar">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={id === tab ? 'active' : undefined}
            onClick={() => setTab(id)}
            aria-current={id === tab ? 'page' : undefined}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
