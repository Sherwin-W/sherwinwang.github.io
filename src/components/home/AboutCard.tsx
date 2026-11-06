import profile from '../../data/profile';

/** "Who am I?" in the owner's own words. The side-quest line points across to the Road to Diamond rail. */
export default function AboutCard() {
  const { title, paragraphs, sideQuest } = profile.about;
  return (
    <article className="bento-tile about">
      <h2>{title}</h2>
      {paragraphs.map((text) => <p key={text.slice(0, 24)}>{text}</p>)}
      <p className="about__quest">{sideQuest.label} <strong>{sideQuest.goal}.</strong></p>
    </article>
  );
}
