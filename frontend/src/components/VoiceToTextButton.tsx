import { IconMicrophone, IconPlayerStop } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionCtor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  }
}

interface Props {
  onAppend: (text: string) => void;
  disabled?: boolean;
}

export function VoiceToTextButton({ onAppend, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const appendRef = useRef(onAppend);
  appendRef.current = onAppend;

  const stableAppend = useCallback((text: string) => {
    appendRef.current(text);
  }, []);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setUnsupported(true);
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = navigator.language || 'en-US';

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const phrase = ev.results[i]?.[0]?.transcript?.trim();
        if (phrase) stableAppend(`${phrase} `);
      }
    };

    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, [stableAppend]);

  function toggle() {
    const rec = recRef.current;
    if (!rec || unsupported || disabled) return;
    if (listening) {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
      setListening(false);
      return;
    }
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  if (unsupported) {
    return (
      <span className="d-inline-block" title="Voice input not supported in this browser">
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled>
          Voice
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`btn btn-sm ${listening ? 'btn-secondary' : 'btn-outline-primary'}`}
      onClick={toggle}
      disabled={disabled}
      title={listening ? 'Stop recording' : 'Speak to append text'}
    >
      {listening ? <IconPlayerStop size={18} className="me-1" /> : <IconMicrophone size={18} className="me-1" />}
      {listening ? 'Stop' : 'Voice'}
    </button>
  );
}
