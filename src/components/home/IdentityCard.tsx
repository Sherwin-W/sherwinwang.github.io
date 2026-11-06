import { EnvelopeSimple, GithubLogo, LinkedinLogo, MapPin, type Icon } from '@phosphor-icons/react';
import profile from '../../data/profile';

const ICONS: Record<string, Icon> = { email: EnvelopeSimple, github: GithubLogo, linkedin: LinkedinLogo };

/** Name, one-line summary, city, and icon links to email, GitHub and LinkedIn. */
export default function IdentityCard() {
  return (
    <article className="bento-tile bento-tile--identity identity">
      <div className="identity__text">
        <h1>{profile.name}</h1>
        <p>{profile.intro}</p>
      </div>
      <div className="identity__foot">
        <p className="identity__place"><MapPin aria-hidden="true" weight="regular" /><span className="visually-hidden">Location: </span>{profile.location}</p>
        <ul className="identity__links" aria-label="Contact">
          {profile.contact.links.map(({ id, label, href, newTab }) => {
            const Glyph = ICONS[id];
            return (
              <li key={id}>
                <a className="identity__icon" href={href} aria-label={newTab ? `${label} (opens in a new tab)` : label} title={label}
                  {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  {Glyph && <Glyph aria-hidden="true" weight="regular" />}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}
