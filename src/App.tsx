import { useState } from 'react';
import { Layers, ListChecks, Search } from 'lucide-react';
import { Pokeball } from './components/Pokeball';
import CollectionScreen from './screens/CollectionScreen';
import SearchScreen from './screens/SearchScreen';
import MasterSetScreen from './screens/MasterSetScreen';

type Tab = 'collection' | 'search' | 'masterset';

const TABS: { id: Tab; label: string; title: string; Icon: typeof Layers }[] = [
  { id: 'collection', label: 'Collection', title: 'POKÉLIST', Icon: Layers },
  { id: 'search', label: 'Search', title: 'POKÉDEX SEARCH', Icon: Search },
  { id: 'masterset', label: 'Master Set', title: 'MASTER SET', Icon: ListChecks },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('collection');
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  // Search reads owned state on mount; bumping this makes it re-read after a collection change.
  const [collectionVersion, setCollectionVersion] = useState(0);

  const active = TABS.find((t) => t.id === tab)!;

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
            onHeaderActions={setHeaderActions}
            onCollectionChanged={() => setCollectionVersion((v) => v + 1)}
          />
        )}
        {tab === 'search' && (
          <SearchScreen
            collectionVersion={collectionVersion}
            onCollectionChanged={() => setCollectionVersion((v) => v + 1)}
          />
        )}
        {tab === 'masterset' && <MasterSetScreen collectionVersion={collectionVersion} />}
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
