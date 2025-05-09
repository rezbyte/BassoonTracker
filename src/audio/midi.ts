import { EVENT } from "../enum";
import EventBus from "../eventBus";
import Tracker from "../tracker";
import Input from "../ui/input";
import Settings from "../settings";

class Midi {
  private enabled = false;

  init() {
    if (navigator.requestMIDIAccess) {
      // TODO: does a browser that supports requestMIDIAccess also always support promises?
      navigator
        .requestMIDIAccess()
        .then(this.onMIDISuccess.bind(this), this.onMIDIFailure);
    } else {
      console.warn("Midi not supported");
      return false;
    }
  }

  enable() {
    this.init();
  }

  disable() {
    this.enabled = false;
    EventBus.trigger(EVENT.midiIn);
  }

  isEnabled(): boolean {
    return !!this.enabled;
  }

  private onMIDISuccess(midiAccess: MIDIAccess) {
    console.log("Midi enabled");
    this.enabled = true;
    const inputs = midiAccess.inputs;

    //for (const input of inputs.values()) input.onmidimessage = getMIDIMessage;
    // this barfs on non ES6 browsers -> use Arrays

    const _inputs = Array.from(inputs.values());
    _inputs.forEach((input) => {
      input.onmidimessage = this.getMIDIMessage;
    });

    if (_inputs.length) {
      EventBus.trigger(EVENT.midiIn);
    }
  }

  private onMIDIFailure() {
    console.log("Could not access your MIDI devices.");
  }

  private getMIDIMessage(midiMessage: MIDIMessageEvent) {
    if (!this.enabled) return;

    const data = midiMessage.data;
    if (data == null) return;

    switch (data[0]) {
      case 128:
      case 129:
        this.noteOff(data[1], data[2]);
        break;
      case 144:
      case 145:
      case 146:
      case 147:
      case 148:
      case 149:
      case 150:
      case 151:
      case 152:
      case 153:
      case 154:
      case 155:
      case 156:
      case 157:
      case 158:
      case 159:
        // TODO: make a difference per midi channel?
        if (data[2]) {
          this.noteOn(data[1], data[2]);
        } else {
          this.noteOff(data[1], data[2]);
        }
        break;
      case 176:
        console.log("Midi: set effect", data[1], data[2]);
        break;
      case 192: {
        // select voice
        const index = data[1];
        Tracker.setCurrentInstrumentIndex(index + 1);
        break;
      }
      case 224:
        console.log("Modulator", data[1], data[2]);
        break;
      default:
      //console.log("Midi In:",data);
    }

    EventBus.trigger(EVENT.midiIn);
  }

  private noteOn(note: number, value: number) {
    console.log("note on", note, value);

    // middle C is 60 - in Bassoon this is 13
    const key = note - 47;
    const octave = Input.octaveHandler.getCurrentOctave();
    const volume = Settings.midi === "enabled" ? (value + 1) >> 1 : undefined;
    Input.keyboard.handleNoteOn(
      key + octave * 12,
      undefined,
      undefined,
      volume,
    );
  }

  private noteOff(note: number, value: number) {
    console.log("note off", note, value);

    const key = note - 47;
    const octave = Input.octaveHandler.getCurrentOctave();
    const register = Settings.midi === "enabled";
    Input.keyboard.handleNoteOff(key + octave * 12, register);
  }
}

export default new Midi();
