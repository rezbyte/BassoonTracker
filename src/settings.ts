import { KEYBOARDTABLE, STEREOSEPARATION } from "./enum";
import Storage from "./storage";
import Audio from "./audio";
import { UI } from "./ui/main";

// TODO: To Enums
type vubarSetting = true | "colour" | "trans" | "none";
export type dropBoxModeSetting = "rename" | "overwrite" | "add";
type midiSetting = "disabled" | "enabled-note" | "enabled";
type keyboardLayout = keyof typeof KEYBOARDTABLE;

class Settings {
  baseUrl = "";
  unrollLoops = false;
  unrollShortLoops = false; // Note: the conversion between byte_length loops (amiga) and time-based loops (Web Audio) is not 100% accurate for very short loops
  sustainKeyboardNotes = false;
  useHover = true;
  keyboardTable: keyboardLayout = "qwerty";
  vubars: vubarSetting = true;
  stereoSeparation: STEREOSEPARATION = STEREOSEPARATION.BALANCED;
  dropboxMode: dropBoxModeSetting = "rename";
  emulateProtracker1OffsetBug = true;
  loadInitialFile = true;
  skipFrame = 1;
  canvasId = "canvas";
  midi: midiSetting = "disabled";
  highDPI = false;
  showKey = false;
  showMidi = false;

  readSettings() {
    const rawSettings = Storage.get("bassoonTrackerSettings");
    try {
      if (!rawSettings) {
        throw new Error("Failed to get settings from local storage!");
      }
      const settings = JSON.parse(rawSettings);
      this.set(settings);
    } catch (e) {
      this.setDefaults();
    }
  }

  saveSettings() {
    const settings = {
      vubars: this.vubars,
      keyboardTable: this.keyboardTable,
      stereoSeparation: this.stereoSeparation,
      dropboxMode: this.dropboxMode,
      skipFrame: UI.getSkipFrame(),
      midi: this.midi,
      highDPI: this.highDPI,
      showKey: this.showKey,
      showMidi: this.showMidi,
    };
    Storage.set("bassoonTrackerSettings", JSON.stringify(settings));
  }

  reset() {
    // reset default Settings;
    this.setDefaults();
    this.saveSettings();
  }

  private set(settings: typeof this) {
    this.setDefaults();

    if (!settings) return;
    for (const key in settings) {
      if (this.hasOwnProperty(key) && settings.hasOwnProperty(key)) {
        this[key] = settings[key];
        if (key === "skipFrame") {
          const valueAsString = String(this[key]);
          const value = parseInt(valueAsString, 10);
          if (!isNaN(value)) UI.skipFrame(value);
        }
      }
    }

    if (this.stereoSeparation) {
      Audio.setStereoSeparation(this.stereoSeparation);
    }
    if (this.highDPI) {
      UI.scaleToDevicePixelRatio(this.highDPI);
    }
  }

  setDefaults() {
    this.keyboardTable = "qwerty";
    this.vubars = "colour";
    this.stereoSeparation = STEREOSEPARATION.BALANCED;
    this.dropboxMode = "rename";
    this.skipFrame = 1;
    this.canvasId = "canvas";
    this.midi = "disabled";
    UI.skipFrame(this.skipFrame);
    this.highDPI = false;
    this.showKey = false;
    this.showMidi = false;
  }
}

export default new Settings();
