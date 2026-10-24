import { useContext } from 'react';
import type { Language } from '@little-galaxy/shared';
import { ProfileContext } from './profile-context';
import { profileHref } from './profile';
/** The same supplied links close the specimen/postcard experience. No invented identity. */
export default function ExperienceLinks({ language }: { language: Language }) {
  const profile = useContext(ProfileContext), es = language === 'es';
  return <nav className="experience-links" aria-label={es ? 'Seguir explorando' : 'Continue exploring'}>
    {profile?.links.length ? profile.links.map((link) => <a key={profileHref(link, 'en')} href={profileHref(link, language)}>{link.label[language]}</a>)
      : <><span>{es ? 'TODO: enlaces del perfil' : 'TODO: profile links'}</span><a href={es ? '/es/' : '/'}>{es ? 'Portafolio' : 'Portfolio'}</a></>}
  </nav>;
}
