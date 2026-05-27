import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Browse from './pages/Browse';
import MyList from './pages/MyList';
import MyPacks from './pages/MyPacks';
import PackView from './pages/PackView';
import PackEdit from './pages/PackEdit';

export default function App() {
  return (
    <>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/me" element={<MyList />} />
          <Route path="/me/packs" element={<MyPacks />} />
          <Route path="/pack/new" element={<PackEdit mode="new" />} />
          <Route path="/pack/:pubkey/:identifier" element={<PackView />} />
          <Route path="/pack/:pubkey/:identifier/edit" element={<PackEdit mode="edit" />} />
        </Routes>
      </main>
      <footer className="footer">
        <a
          href="https://github.com/koteitan/emoemo"
          target="_blank"
          rel="noreferrer noopener"
        >
          GitHub: koteitan/emoemo
        </a>
      </footer>
    </>
  );
}
