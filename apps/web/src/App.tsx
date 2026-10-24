import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Route, Routes, useSearchParams, useLocation } from 'react-router';
import { isLanguage, supportedLanguages } from '@little-galaxy/shared';
import { persistLanguage, resolveLanguage } from './language';
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
  const creditsButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const [search, setSearch] = useSearchParams();
  const [preferredLanguage, setPreferredLanguage] = useState(() => resolveLanguage(window.location.search, () => localStorage));
  const queryLanguage = search.get('lang');
  const language = isLanguage(queryLanguage) ? queryLanguage : preferredLanguage;
  const text = copy[language];
  const [theme, setTheme] = useState(resolveTheme);
  const [explicitTheme, setExplicitTheme] = useState(() => savedTheme() !== null);

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

  const portfolio = language === 'es' ? '/es/' : '/';
  const page = pathname.endsWith('/screen') ? 'screen' : pathname.endsWith('/create') ? 'create' : pathname.includes('/o/') ? 'object' : 'home';
  function finishClose() { setMenuOpen(false); creditsButton.current?.focus(); }
  function closeSheet() { sheet.current?.close?.(); sheet.current?.removeAttribute('open'); finishClose(); }
  function openSheet() { setMenuOpen(true); if (sheet.current?.showModal) sheet.current.showModal(); else sheet.current?.setAttribute('open', ''); }
  return (
    <div className="app-shell" data-page={page}>
      <a className="skip-link" href="#content">{text.skip}</a>
      <button ref={creditsButton} className="credits-toggle" aria-haspopup="dialog" aria-controls="galaxy-credits" aria-expanded={menuOpen} onClick={openSheet}>{text.credits}</button>
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

      <dialog id="galaxy-credits" ref={sheet} className="credits-card" aria-label={text.credits} onClose={finishClose} onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]');
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
        <button autoFocus className="credits-close" onClick={closeSheet}>{language === 'es' ? 'Cerrar' : 'Close'}</button>
        <h2>{text.productName}</h2>
        <p>Alexander Kholodov · USFQ</p>
        <a href={portfolio}>{text.portfolio}</a>
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
    </div>
  );
}
