import { useEffect } from "react";
import { unlockAudio } from "./error-sound";

export function useAudioUnlock() {
  useEffect(() => {
    document.addEventListener("pointerdown", unlockAudio, true);
    document.addEventListener("keydown", unlockAudio, true);
    return () => {
      document.removeEventListener("pointerdown", unlockAudio, true);
      document.removeEventListener("keydown", unlockAudio, true);
    };
  }, []);
}
