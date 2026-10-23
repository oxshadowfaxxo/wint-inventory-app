import { useEffect, useState } from "react";
import {
  DEFAULT_PREFERENCES,
  playErrorSound,
  readPreferences,
  savePreferences,
  unlockAudio,
} from "../features/scanner-audio/error-sound";
import { useAudioUnlock } from "../features/scanner-audio/use-audio-unlock";

export default function Settings() {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [testMessage, setTestMessage] = useState("");
  useAudioUnlock();
  useEffect(() => {
    setPreferences(readPreferences());
  }, []);

  function update(changes) {
    setPreferences(savePreferences({ ...preferences, ...changes }));
  }

  function testAudio() {
    unlockAudio();
    window.setTimeout(() => {
      const played = playErrorSound();
      setTestMessage(
        played
          ? "Error sound played."
          : "No sound played. Check that audio is enabled, volume is above zero, and browser audio is allowed; then try again.",
      );
    }, 50);
  }

  return (
    <s-page heading="Settings">
      <s-section heading="Scanner & Audio">
        <s-stack direction="block" gap="base">
          <label>
            <input
              type="checkbox"
              role="switch"
              checked={preferences.enabled}
              onChange={(event) => update({ enabled: event.target.checked })}
            />{" "}
            Enable Error Sound
          </label>
          <label htmlFor="error-sound-volume">
            Error Sound Volume — {preferences.volume}%
          </label>
          <input
            id="error-sound-volume"
            type="range"
            min="0"
            max="100"
            step="1"
            value={preferences.volume}
            aria-valuetext={`${preferences.volume}%`}
            onChange={(event) => update({ volume: Number(event.target.value) })}
          />
          <s-button onClick={testAudio}>Test Error Sound</s-button>
          <s-paragraph>
            Preferences save automatically in this browser on this device.
          </s-paragraph>
          <span role="status">{testMessage}</span>
        </s-stack>
      </s-section>
    </s-page>
  );
}
