import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { shortNpub } from '../nostr/nip19';

export default function Header() {
  const { t, i18n } = useTranslation();
  const { pubkey, profile, hasExtension, loading, error, login, logout } = useAuth();

  const toggleLang = () => i18n.changeLanguage(i18n.language.startsWith('ja') ? 'en' : 'ja');

  return (
    <header className="header">
      <Link to="/" className="brand">
        <span className="brand-emoji">🥰</span>
        <span className="brand-name">{t('app.title')}</span>
      </Link>

      <nav className="nav">
        <NavLink to="/" end>
          {t('nav.browse')}
        </NavLink>
        {pubkey && <NavLink to="/me">{t('nav.myList')}</NavLink>}
        {pubkey && <NavLink to="/me/packs">{t('nav.myPacks')}</NavLink>}
        {pubkey && <NavLink to="/pack/new">{t('nav.newPack')}</NavLink>}
      </nav>

      <div className="header-right">
        <button className="lang-toggle" onClick={toggleLang} title="Language">
          {i18n.language.startsWith('ja') ? 'EN' : 'JA'}
        </button>
        {pubkey ? (
          <div className="user">
            {profile?.picture && <img className="avatar" src={profile.picture} alt="" />}
            <span className="user-name">
              {profile?.display_name || profile?.name || shortNpub(pubkey)}
            </span>
            <button className="btn-ghost" onClick={logout}>
              {t('auth.logout')}
            </button>
          </div>
        ) : (
          <div className="login-box">
            <button
              className="btn"
              disabled={loading}
              onClick={login}
              title={hasExtension ? undefined : t('auth.noExtension')}
            >
              {loading ? t('common.loading') : t('auth.login')}
            </button>
            {(error || !hasExtension) && (
              <span className="login-hint">{error ?? t('auth.noExtension')}</span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
