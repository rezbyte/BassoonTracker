import Knob from "./components/knob";
import Panel from "./components/panel";
import Scale9Panel from "./components/scale9";
import Audio from "../audio";
import FilterChain from "../audio/filterChain";
import Assets from "./assets";
import { UI } from "./main";

export default class FxPanel extends Panel {
  private background: Scale9Panel;
  private knobSpaceX: number;
  private knobSpaceY: number;
  private KnobTop: number;
  private knobLeft: number;
  private knobs: Knob[] = [];
  private filterChain: FilterChain | null = null;

  constructor(track?: number) {
    // UI.fxPanel
    super();
    this.hide();

    track = track || 0;

    this.background = new Scale9Panel(0, 0, 20, 20, Assets.buttonDarkScale9);
    this.background.ignoreEvents = true;
    this.addChild(this.background);

    this.knobSpaceX = 70;
    this.knobSpaceY = 70;
    const effects = [
      "volume",
      "panning",
      "high",
      "mid",
      "low",
      "lowPass",
      "reverb",
    ];

    this.KnobTop = 0;
    this.knobLeft = 10;

    for (let i = 0, len = effects.length; i < len; i++) {
      const knob = new Knob();
      knob.setProperties({
        top: this.KnobTop,
        left: this.knobLeft,
        label: effects[i],
        disabled: i > 1,
      });
      knob.onChange = (value) => {
        this.handleKnob(knob, value);
      };
      knob.onToggle = (value) => {
        this.handleKnobState(knob, value);
        this.handleKnob(knob, knob.getValue());
      };
      this.addChild(knob);
      this.knobs.push(knob);

      if (i % 2 == 0) {
        this.knobLeft = this.knobLeft + this.knobSpaceX;
      } else {
        this.knobLeft = 10;
        this.KnobTop += this.knobSpaceY;
      }
    }

    this.filterChain = Audio.getFilterChain(track);
  }
  private handleKnob(knob: Knob, value: number) {
    if (!this.filterChain) return;
    if (knob.isDisabled) return;

    const label = knob.getLabel();

    switch (label) {
      case "volume": {
        this.filterChain.volumeValue(value);
        break;
      }
      case "panning": {
        this.filterChain.panningValue((value - 50) / 50);
        break;
      }
      case "high": {
        this.filterChain.highValue(value / 100);
        break;
      }
      case "mid": {
        this.filterChain.midValue(value / 100);
        break;
      }
      case "low": {
        this.filterChain.lowValue(value / 100);
        break;
      }
      case "lowPass": {
        this.filterChain.lowPassFrequencyValue(value / 100);
        break;
      }
      case "reverb": {
        this.filterChain.reverbValue(value);
        break;
      }
    }
  }

  private handleKnobState(knob: Knob, value: boolean) {
    if (!this.filterChain) return;
    const label = knob.getLabel();
    this.filterChain.setState(label, value);
  }

  setLayout() {
    if (!UI.mainPanel) return;
    //this.clearCanvas();

    this.background.setSize(this.width, this.height);

    const knobSize = 70;

    const cols = Math.max(1, Math.floor(this.width / knobSize));

    const margin = Math.floor((this.width - cols * knobSize) / 2);
    const colWidth = Math.floor((this.width - margin * 2) / cols);
    const knobSpaceY = 70;
    let knobTop = 0;

    this.knobs.forEach((knob, index) => {
      const colIndex = index % cols;
      knob.setPosition(colIndex * colWidth + margin, knobTop);
      if (colIndex === cols - 1) {
        knobTop += knobSpaceY;
      }
    });
  }
}
