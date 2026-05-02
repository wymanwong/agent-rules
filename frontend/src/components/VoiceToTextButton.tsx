import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import { Button, Tooltip } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionCtor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  }
}

interface Props {
  /** Called with each finalized phrase segment (append to your field). */
  onAppend: (text: string) => void;
  disabled?: boolean;
}

/** Uses browser Web Speech API (Chrome/Edge/Safari often supported). Requires HTTPS except localhost. */
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
      <Tooltip title="Voice input is not supported in this browser">
        <span>
          <Button size="small" disabled variant="outlined">
            Voice
          </Button>
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={listening ? 'Stop recording' : 'Speak to append text (browser speech recognition)'}>
      <Button
        size="small"
        variant={listening ? 'contained' : 'outlined'}
        color={listening ? 'secondary' : 'primary'}
        startIcon={listening ? <StopIcon /> : <MicIcon />}
        onClick={toggle}
        disabled={disabled}
      >
        {listening ? 'Stop' : 'Voice'}
      </Button>
    </Tooltip>
  );
}
