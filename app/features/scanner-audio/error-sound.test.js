/* global globalThis */
import assert from "node:assert/strict";
import { test } from "node:test";

test("barcode audio classification, preferences, and safe playback", async () => {
  const audio = await import("./error-sound.js");
  assert.deepEqual(audio.readPreferences(), { enabled: true, volume: 70 });
  assert.equal(audio.playErrorSound(), false);
  for (const code of [
    "BARCODE_NOT_FOUND",
    "SHOPIFY_BARCODE_NOT_FOUND",
    "DUPLICATE_SHOPIFY_BARCODE",
    "INACTIVE_PRODUCT",
    "INVENTORY_NOT_TRACKED",
    "NOT_STOCKED_AT_LOCATION",
    "MISSING_ON_HAND",
  ]) {
    assert.equal(
      audio.isBarcodeFailure({ scanError: true, barcodeErrorCode: code }),
      true,
    );
  }
  for (const data of [
    undefined,
    { error: "Network failure" },
    { scanError: true },
    { scanError: true, barcodeErrorCode: "INVALID_TRANSITION" },
    { scan: { line: { id: "1" } } },
  ]) {
    assert.equal(audio.isBarcodeFailure(data), false);
  }
  assert.equal(audio.isBarcodeFailure({ scan: { duplicate: true } }), true);

  const storage = new Map();
  const tones = [];
  const gains = [];
  class FakeContext {
    state = "running";
    currentTime = 0;
    destination = {};
    createGain() {
      const gain = {
        value: 0,
        setValueAtTime(value) {
          this.value = value;
        },
        linearRampToValueAtTime() {},
      };
      gains.push(gain);
      return { gain, connect() {}, disconnect() {} };
    }
    createOscillator() {
      const tone = {
        frequency: {
          setValueAtTime(value) {
            tone.pitch = value;
          },
        },
        connect() {},
        disconnect() {},
        start(at) {
          tone.startAt = at;
        },
        stop(at) {
          tone.stopAt = at;
        },
      };
      tones.push(tone);
      return tone;
    }
  }
  globalThis.window = {
    AudioContext: FakeContext,
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
  };
  try {
    audio.savePreferences({ enabled: true, volume: 30 });
    const reopened = await import("./error-sound.js?reopened");
    assert.deepEqual(reopened.readPreferences(), { enabled: true, volume: 30 });
    assert.deepEqual(JSON.parse(storage.get(audio.STORAGE_KEY)), {
      enabled: true,
      volume: 30,
    });
    audio.unlockAudio();
    assert.equal(audio.playErrorSound(), true);
    assert.equal(tones.length, 2);
    assert.equal(tones[0].pitch, 220);
    assert.equal(tones[0].stopAt - tones[0].startAt, 0.15);
    assert.equal(tones[1].startAt, 0.23);
    assert.equal(gains[0].value, 0.06);
    assert.equal(audio.playErrorSound(), false);
    assert.equal(tones.length, 2);
    audio.savePreferences({ enabled: false, volume: 70 });
    assert.equal(gains[0].value, 0);
    assert.equal(audio.playErrorSound(), false);
    audio.savePreferences({ enabled: true, volume: 0 });
    assert.equal(audio.playErrorSound(), false);
    storage.set(audio.STORAGE_KEY, '{"enabled":"invalid","volume":999}');
    assert.deepEqual(audio.readPreferences(), { enabled: true, volume: 100 });
    storage.set(audio.STORAGE_KEY, "broken JSON");
    assert.doesNotThrow(audio.readPreferences);
    globalThis.window.localStorage = {
      getItem() {
        throw Error("blocked");
      },
      setItem() {
        throw Error("blocked");
      },
    };
    assert.doesNotThrow(() =>
      audio.savePreferences({ enabled: false, volume: 10 }),
    );
    assert.deepEqual(audio.readPreferences(), { enabled: false, volume: 10 });
    globalThis.window.AudioContext = class {
      constructor() {
        throw Error("blocked audio");
      }
    };
    // A fresh module has no existing context, so constructor failure is exercised.
    assert.doesNotThrow(reopened.unlockAudio);
    assert.equal(reopened.playErrorSound(), false);
    storage.clear();
    globalThis.window.localStorage = {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    };
    const differentBrowser = await import("./error-sound.js?different-browser");
    assert.deepEqual(differentBrowser.readPreferences(), {
      enabled: true,
      volume: 70,
    });
  } finally {
    delete globalThis.window;
  }
});
