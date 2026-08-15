import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Browse from './pages/Browse';
import MyList from './pages/MyList';
import MyPacks from './pages/MyPacks';
import PackView from './pages/PackView';
import PackAddr from './pages/PackAddr';
import PackEdit from './pages/PackEdit';
import CopyItem from './pages/CopyItem';

// Redirect any legacy /pack/... URL to the matching /set/... URL.
function PackRedirect() {
  const { pathname, search } = useLocation();
  const to = pathname.replace(/^\/pack(?=\/|$)/, '/set') + search;
  return <Navigate to={to} replace />;
}

export default function App() {
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/me/list" element={<MyList />} />
          <Route path="/me/sets" element={<MyPacks />} />
          <Route path="/set/new" element={<PackEdit mode="new" />} />
          <Route path="/set/copyitem/:pubkey/:identifier" element={<CopyItem />} />
          <Route path="/a/:naddr" element={<PackAddr />} />
          <Route path="/set/:pubkey/:identifier" element={<PackView />} />
          <Route path="/set/:pubkey/:identifier/edit" element={<PackEdit mode="edit" />} />
          {/* old paths -> new canonical URLs */}
          <Route path="/me" element={<Navigate to="/me/list" replace />} />
          <Route path="/me/packs" element={<Navigate to="/me/sets" replace />} />
          <Route path="/pack/*" element={<PackRedirect />} />
        </Routes>
      </main>
      <footer className="footer">
        <a
          href="https://github.com/koteitan/emoemo"
          target="_blank"
          rel="noreferrer noopener"
        >
          GitHub: koteitan/emoemo
        </a>{' '}
        <span className="version">v{__APP_VERSION__}</span>
      </footer>
    </>
  );
}
