import Instrument from "../models/instrument";
import Panel from "./components/panel";
import Scale9Panel from "./components/scale9";
import Envelope, { EnvelopeType } from "./envelope";
import Assets from "./assets";
import Label from "./components/label";
import Checkbox from "./components/checkbox";
import SpinBox from "./spinBox";
import { UI } from "./main";
import Button from "./components/button";
import { Envelope as EnvelopeModel } from "../models/instrument";

export default class EnvelopePanel extends Panel {
  private currentInstrument: Instrument | null;
  private envelope: EnvelopeModel | null;
  private envelopeGraph: Envelope;
  private enabledCheckbox: Checkbox;
  private sustainCheckBox: Checkbox;
  private loopCheckBox: Checkbox;
  private sustainSpinbox: SpinBox;
  private loopFromSpinbox: SpinBox;
  private loopToSpinbox: SpinBox;
  private disabled: boolean;
  private panel: Panel;
  private titleBar: Scale9Panel;
  private titleLabel: Label;
  private background: Scale9Panel;
  private sustainLabel: Label;
  private loopLabel: Label;
  private buttonAdd: Button;
  private buttonRemove: Button;

  constructor(type: EnvelopeType) {
    // UI.EnvelopePanel
    super();
    this.type = type;

    this.currentInstrument = null;
    this.envelope = null;
    this.disabled = false;

    this.titleBar = new Scale9Panel(0, 0, 20, 20, Assets.panelDarkGreyScale9);
    this.titleBar.ignoreEvents = true;
    this.addChild(this.titleBar);

    this.titleLabel = new Label({
      label: type + " Envelope",
      font: UI.fontSmall,
    });
    this.titleLabel.onClick = () => {
      this.enabledCheckbox.toggle();
    };
    this.addChild(this.titleLabel);

    this.enabledCheckbox = new Checkbox();
    this.enabledCheckbox.onToggle = (checked) => {
      if (this.envelope) {
        this.envelope.enabled = checked;
        this.envelopeGraph.refresh();
      }
    };
    this.addChild(this.enabledCheckbox);

    this.buttonAdd = Assets.generate("button20_20");
    this.buttonAdd.onDown = () => {
      if (!this.envelope?.enabled) return;
      if (this.envelope.points.length > this.envelope.count) {
        const prevPoint = this.envelope.points[this.envelope.count - 1] || [
          0, 0,
        ];
        const nextPoint = this.envelope.points[this.envelope.count];
        if (prevPoint[0] + 10 < 320) {
          if (nextPoint[0] <= prevPoint[0]) {
            nextPoint[0] = prevPoint[0] + 10;
          }
          this.envelope.count++;
        }
      } else {
        const lastPoint = this.envelope.points[this.envelope.points.length - 1];
        if (lastPoint[0] + 10 < 320) {
          const newPoint: [number, number] = [lastPoint[0] + 10, 32];
          this.envelope.points.push(newPoint);
          this.envelope.count = this.envelope.points.length;
        }
      }
      this.envelopeGraph.refresh();
    };
    this.buttonAdd.setProperties({
      label: "+",
      width: 18,
      height: 18,
    });
    this.addChild(this.buttonAdd);

    this.buttonRemove = Assets.generate("button20_20");
    this.buttonRemove.onDown = () => {
      if (!this.envelope?.enabled) return;
      if (this.envelope.count > 2) {
        this.envelope.count--;
        this.checkMax();
      }
      this.envelopeGraph.refresh();
    };
    this.buttonRemove.setProperties({
      label: "-",
      width: 18,
      height: 18,
    });
    this.addChild(this.buttonRemove);

    this.envelopeGraph = new Envelope(type);
    this.addChild(this.envelopeGraph);

    this.panel = new Panel(0, 0, 20, 20);

    this.sustainCheckBox = new Checkbox();
    this.loopCheckBox = new Checkbox();
    this.sustainSpinbox = new SpinBox();
    this.loopFromSpinbox = new SpinBox();
    this.loopToSpinbox = new SpinBox();

    this.sustainCheckBox.onToggle = (checked) => {
      if (!this.envelope) return;
      this.sustainSpinbox.setDisabled(!checked);
      this.envelope.sustain = checked;
      this.envelopeGraph.refresh();
    };
    this.loopCheckBox.onToggle = (checked) => {
      if (!this.envelope) return;
      this.loopFromSpinbox.setDisabled(!checked);
      this.loopToSpinbox.setDisabled(!checked);
      this.envelope.loop = checked;
      this.envelopeGraph.refresh();
    };

    this.sustainSpinbox.setProperties({
      label: " ",
      name: this.type + " envelope sustain",
      value: 0,
      max: 100,
      min: 0,
      padLength: 2,
      disabled: true,
      font: UI.fontFT,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        if (this.envelope === null) return;
        this.envelope.sustainPoint = value;
        this.checkMax();
        this.envelopeGraph.refresh();
      },
    });
    this.loopFromSpinbox.setProperties({
      label: "From",
      name: this.type + " envelope loop from",
      value: 0,
      max: 100,
      min: 0,
      padLength: 2,
      disabled: true,
      font: UI.fontSmall,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        if (this.envelope === null) return;
        this.envelope.loopStartPoint = value;
        this.checkMax();
        this.envelopeGraph.refresh();
      },
    });
    this.loopToSpinbox.setProperties({
      label: "To",
      name: this.type + " envelope loop to",
      value: 0,
      max: 100,
      min: 0,
      padLength: 2,
      disabled: true,
      font: UI.fontSmall,
      trackUndo: true,
      undoInstrument: true,
      onChange: (value) => {
        if (this.envelope === null) return;
        this.envelope.loopEndPoint = value;
        this.checkMax();
        this.envelopeGraph.refresh();
      },
    });

    this.background = new Scale9Panel(
      0,
      0,
      this.panel.width,
      this.panel.height,
      Assets.panelMainScale9,
    );
    this.background.ignoreEvents = true;
    this.panel.addChild(this.background);

    this.panel.addChild(this.sustainSpinbox);
    this.panel.addChild(this.loopFromSpinbox);
    this.panel.addChild(this.loopToSpinbox);

    this.sustainLabel = new Label({
      label: "Sustain",
      font: UI.fontSmall,
      width: 60,
    });
    this.panel.addChild(this.sustainLabel);
    this.loopLabel = new Label({
      label: "Loop",
      font: UI.fontSmall,
      width: 60,
    });
    this.panel.addChild(this.loopLabel);
    this.panel.addChild(this.sustainCheckBox);
    this.panel.addChild(this.loopCheckBox);

    this.addChild(this.panel);
  }
  setInstrument(instrument?: Instrument) {
    if (!instrument) return;
    if (this.type === "volume") {
      this.envelope = instrument.volumeEnvelope;
    } else if (this.type === "panning") {
      this.envelope = instrument.panningEnvelope;
    } else {
      console.error(`Invalid envelope type: ${this.type}`);
      return;
    }
    this.currentInstrument = instrument;

    this.envelopeGraph.setInstrument(instrument);
    this.enabledCheckbox.setState(this.envelope && this.envelope.enabled);
    this.sustainCheckBox.setState(this.envelope && this.envelope.sustain);
    this.loopCheckBox.setState(this.envelope && this.envelope.loop);

    this.sustainSpinbox.setValue(this.envelope.sustainPoint || 0, true);
    this.loopFromSpinbox.setValue(this.envelope.loopStartPoint || 0, true);
    this.loopToSpinbox.setValue(this.envelope.loopEndPoint || 0, true);
  }

  setDisabled(value: boolean) {
    this.disabled = value;
    this.ignoreEvents = this.disabled;
    this.refresh();
  }

  onResize() {
    this.panel.setSize(120, this.height);
    const panelWidth = this.panel.width;

    this.titleBar.setSize(this.width - panelWidth - 36, 18);
    this.titleLabel.setSize(this.width - panelWidth, 20);
    this.enabledCheckbox.setPosition(2, 2);
    this.titleLabel.setPosition(12, 2);
    this.envelopeGraph.setPosition(0, 20);
    this.envelopeGraph.setSize(this.width - panelWidth + 1, this.height - 22);

    this.background.setSize(this.panel.width, this.panel.height);
    this.panel.setPosition(this.width - this.panel.width, 0);
    this.sustainCheckBox.setPosition(4, 4);
    this.sustainLabel.setPosition(14, 4);

    this.sustainSpinbox.setProperties({
      left: 10,
      top: 20,
      width: 100,
      height: 28,
    });

    this.loopCheckBox.setPosition(5, 50);
    this.loopLabel.setPosition(14, 50);

    this.loopFromSpinbox.setProperties({
      left: 10,
      top: 70,
      width: 100,
      height: 28,
    });

    this.loopToSpinbox.setProperties({
      left: 10,
      top: 98,
      width: 100,
      height: 28,
    });

    this.buttonAdd.setPosition(this.titleBar.width, this.titleBar.top);
    this.buttonRemove.setPosition(this.titleBar.width + 18, this.titleBar.top);
  }

  renderInternal() {
    if (this.disabled) {
      this.ctx.fillStyle = "rgba(34, 49, 85, 0.4)";
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private checkMax() {
    if (this.envelope?.count) {
      if (this.envelope.sustainPoint >= this.envelope.count)
        this.sustainSpinbox.setValue(this.envelope.count - 1);
      if (this.envelope.loopStartPoint >= this.envelope.count)
        this.loopFromSpinbox.setValue(this.envelope.count - 1);
      if (this.envelope.loopEndPoint >= this.envelope.count)
        this.loopToSpinbox.setValue(this.envelope.count - 1);
    }
  }
}
