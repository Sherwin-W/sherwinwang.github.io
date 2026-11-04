import { Keyboard, Microphone } from '@phosphor-icons/react';
import { APP_NAME, DISCLAIMER } from '../brand';
import { MAX_QUESTIONS } from '../engine';
import { SCENES } from '../stage2/scenes';
import Window from './Window';
import Portrait from './Portrait';
import VoiceCredits from './VoiceCredits';

interface Props { speechSupported: boolean; onStart: (voice: boolean) => void }

export default function Intro({ speechSupported, onStart }: Props) {
  return (
    <Window title="welcome.exe" accent="coral" labelledBy="mb-intro-h" className="mb-intro">
      <div className="mb-intro__cast" aria-hidden="true">
        {SCENES.slice(0, 5).map((s) => <Portrait key={s.id} spec={s.character.portrait} expression="happy" speaking={false} still className="mb-intro__face" />)}
      </div>
      <h1 id="mb-intro-h" className="mb-h1">{APP_NAME}</h1>
      <p className="mb-lede">Two short stages. First, up to {MAX_QUESTIONS} questions about how you like to do things. Then {SCENES.length} short video calls with characters voiced by real people: someone asks you something, and you answer as you naturally would.</p>
      <ul className="mb-facts">
        <li>About 8–12 minutes. Skip anything you like.</li>
        <li><strong>Free and private:</strong> everything runs in this tab. Nothing is sent to my server or stored, and the page forgets it all when you leave or reset.</li>
        <li><strong>Microphone:</strong> your browser turns speech into text. Chrome and Edge may use their own online speech service for that; this site never records or keeps audio. Typing works everywhere.</li>
        <li>The reading is based on the words you use, never on your voice, accent or who the characters are.</li>
      </ul>
      <VoiceCredits />
      <p className="mb-disclaimer">{DISCLAIMER}</p>
      <div className="mb-actions">
        <button type="button" className="mb-btn mb-btn--primary" onClick={() => onStart(true)} disabled={!speechSupported}>
          <Microphone aria-hidden="true" weight="fill" /> Answer out loud
        </button>
        <button type="button" className="mb-btn" onClick={() => onStart(false)}><Keyboard aria-hidden="true" /> Type instead</button>
      </div>
      {!speechSupported && <p className="mb-hint">This browser does not support speech recognition, so typing is the way to go here.</p>}
    </Window>
  );
}
