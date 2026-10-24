import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useSearchParams, useLocation } from 'react-router';
import { isLanguage, supportedLanguages } from '@little-galaxy/shared';
import { persistLanguage, resolveLanguage } from './language';
import { loadProfile, profileHref } from './profile';
import type { Profile } from './profile';
import { ProfileContext } from './profile-context';
import { copy } from './copy';
import { applyTheme, resolveTheme, savedTheme, themeQuery } from './theme';
import SessionLine from './SessionLine';
import Create from './Create';
const ObjectPage = lazy(() => import('./ObjectPage'));
const Home = lazy(() => import('./Home'));
const Screen = lazy(() => import('./Screen'));

type Page = 'talk' | 'missing';

function PageContent({ page, text }: { page: Page; text: typeof copy.en | typeof copy.es }) {
  return (
    <>
      <section className="page-heading">
        <h1>{text[`${page}Title`]}</h1>
        <p className="intro">{text[`${page}Text`]}</p>
      </section>
      {page === 'talk' && <SessionLine text={text} />}
    </>
  );
}

export default function App() {
  const sheet = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const [search, setSearch] = useSearchParams();
  const [preferredLanguage, setPreferredLanguage] = useState(() => resolveLanguage(window.location.search, () => localStorage));
  const queryLanguage = search.get('lang');
  const language = isLanguage(queryLanguage) ? queryLanguage : preferredLanguage;
  const text = copy[language];
  const [theme, setTheme] = useState(resolveTheme);
  const [explicitTheme, setExplicitTheme] = useState(() => savedTheme() !== null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = text.productName;
    persistLanguage(language, () => localStorage);
  }, [language, text.productName]);

  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    if (explicitTheme) return;
    const preference = window.matchMedia(themeQuery);
    const followSystem = () => setTheme(preference.matches ? 'dark' : 'light');
    preference.addEventListener('change', followSystem);
    return () => preference.removeEventListener('change', followSystem);
  }, [explicitTheme]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    void loadProfile(controller.signal).then((value) => {
      if (!controller.signal.aborted) setProfile(value);
    });
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, []);

  const suffix = `?lang=${language}`;
  const portfolio = language === 'es' ? '/es/' : '/';
  const page = pathname.endsWith('/screen') ? 'screen' : pathname.endsWith('/create') ? 'create' : pathname.includes('/o/') ? 'object' : 'home';
  function closeSheet() { sheet.current?.close?.(); sheet.current?.removeAttribute('open'); setMenuOpen(false); }
  function openSheet() { setMenuOpen(true); if (sheet.current?.showModal) sheet.current.showModal(); else sheet.current?.setAttribute('open', ''); }
  return (
    <ProfileContext.Provider value={profile}><div className="app-shell" data-page={page}>
      <a className="skip-link" href="#content">{text.skip}</a>
      <button className="galaxy-mark" aria-label={language === 'es' ? 'Abrir menú de la galaxia' : 'Open galaxy menu'} aria-haspopup="dialog" aria-expanded={menuOpen} onClick={openSheet}>
        <svg width="23" height="22" viewBox="0 0 23 22" fill="currentColor" aria-hidden="true"><path d="M0 0h5v22H0zM9 6h5v16H9zM18 12h5v10h-5z"/></svg>
      </button>
        <div className="preferences game-preferences">
          <div className="language-switch" role="group" aria-label={text.language}>
            {supportedLanguages.map((choice) => (
              <button key={choice} lang={choice} aria-pressed={language === choice} onClick={() => {
                setPreferredLanguage(choice);
                setSearch((params) => { params.set('lang', choice); return params; }, { replace: true });
              }}>{choice.toUpperCase()}</button>
            ))}
          </div>
          <button className="theme-switch" aria-pressed={theme === 'dark'} onClick={() => {
            const next = theme === 'light' ? 'dark' : 'light';
            setExplicitTheme(true);
            setTheme(next);
            applyTheme(next);
            try { localStorage.setItem('galaxy.theme', next); } catch { /* The explicit choice still lasts this session. */ }
          }}>{text.dark}</button>
        </div>

      <dialog ref={sheet} className="identity-sheet" aria-label={text.portfolio} onClose={() => setMenuOpen(false)}>
        <button className="sheet-close" onClick={closeSheet}>{language === 'es' ? 'Cerrar' : 'Close'}</button>
        <a className="signature" href={portfolio}>
          <svg width="23" height="22" viewBox="0 0 23 22" fill="currentColor" aria-hidden="true">
            <path d="M0 0h5v22H0zM9 6h5v16H9zM18 12h5v10h-5z" />
          </svg>
          <span>{profile?.name ?? text.productName}</span>
        </a>
        <nav className="profile-links" aria-label={text.portfolio}>
          {profile?.links.length ? profile.links.map((link) => <a key={JSON.stringify([profileHref(link, 'en'), profileHref(link, 'es')])} href={profileHref(link, language)}>{link.label[language]}</a>) : <><span>{language === 'es' ? 'TODO: enlaces del perfil' : 'TODO: profile links'}</span><a href={portfolio}>{text.portfolio}</a></>}
        </nav>
      <nav className="galaxy-nav" aria-label={text.nav}>
        {(['home', 'screen', 'create'] as const).map((page) => (
          <NavLink key={page} to={`${page === 'home' ? '/' : `/${page}`}${suffix}`} end onClick={closeSheet}>{text[page]}</NavLink>
        ))}
      </nav>
      </dialog>
      <main id="content">
        <Routes>
          <Route index element={<Suspense fallback={<p>{text.loadingSky}</p>}><Home language={language}/></Suspense>} />
          <Route path="screen" element={<Suspense fallback={<p>{text.loadingSky}</p>}><Screen language={language} /></Suspense>} />
          <Route path="create" element={<Create language={language} />} />
          <Route path="talk" element={<PageContent page="talk" text={text} />} />
          <Route path="o/:id" element={<Suspense fallback={<p>{text.loadingSky}</p>}><ObjectPage language={language}/></Suspense>} />
          <Route path="*" element={<PageContent page="missing" text={text} />} />
        </Routes>
      </main>
    </div></ProfileContext.Provider>
  );
}
