import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useSearchParams } from 'react-router';
import { isLanguage, supportedLanguages } from '@little-galaxy/shared';
import { persistLanguage, resolveLanguage } from './language';
import { loadProfile, profileHref } from './profile';
import type { Profile } from './profile';
import { copy } from './copy';
import { applyTheme, resolveTheme, savedTheme, themeQuery } from './theme';
import ReferenceSky from './ReferenceSky';
import SessionLine from './SessionLine';
import Create from './Create';
import Screen from './Screen';

type Page = 'home' | 'screen' | 'create' | 'talk' | 'object' | 'missing';

function PageContent({ page, text }: { page: Page; text: typeof copy.en | typeof copy.es }) {
  return (
    <>
      <section className="page-heading">
        <h1>{text[`${page}Title`]}</h1>
        <p className="intro">{text[`${page}Text`]}</p>
      </section>
      {(page === 'home' || page === 'screen') && (
        <figure className="sky-chart">
          <div className="sky-view">
            <ReferenceSky unavailable={text.unavailable} label={text.chart} loading={text.loadingSky} retry={text.retrySky} />
          </div>
          <figcaption><span className="chart-cross" aria-hidden="true">+</span>{text.chartNote}</figcaption>
        </figure>
      )}
      {(page === 'create' || page === 'talk') && <SessionLine text={text} />}
    </>
  );
}

export default function App() {
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
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">{text.skip}</a>
      <header className="portfolio-header">
        <a className="signature" href={portfolio}>
          <svg width="23" height="22" viewBox="0 0 23 22" fill="currentColor" aria-hidden="true">
            <path d="M0 0h5v22H0zM9 6h5v16H9zM18 12h5v10h-5z" />
          </svg>
          <span>{profile?.name ?? text.productName}</span>
        </a>
        <nav className="profile-links" aria-label={text.portfolio}>
          {profile?.links.length ? profile.links.map((link) => <a key={JSON.stringify([profileHref(link, 'en'), profileHref(link, 'es')])} href={profileHref(link, language)}>{link.label[language]}</a>) : <a href={portfolio}>{text.portfolio}</a>}
        </nav>
        <div className="preferences">
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
      </header>
      <nav className="galaxy-nav" aria-label={text.nav}>
        {(['home', 'screen', 'create', 'talk'] as const).map((page) => (
          <NavLink key={page} to={`${page === 'home' ? '/' : `/${page}`}${suffix}`} end>{text[page]}</NavLink>
        ))}
      </nav>
      <main id="content">
        <Routes>
          <Route index element={<PageContent page="home" text={text} />} />
          <Route path="screen" element={<Screen language={language} />} />
          <Route path="create" element={<Create language={language} />} />
          <Route path="talk" element={<PageContent page="talk" text={text} />} />
          <Route path="o/:id" element={<PageContent page="object" text={text} />} />
          <Route path="*" element={<PageContent page="missing" text={text} />} />
        </Routes>
      </main>
    </div>
  );
}
