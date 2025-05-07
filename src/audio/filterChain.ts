import Audio from "../audio";
import { cachedAssets, PRELOADTYPE } from "../enum";
import { Filters } from "../audio";
import PreLoader from "../preloader";

export default class FilterChain {
  private useVolume: boolean;
  private usePanning: boolean;
  private useHigh: boolean;
  private useMid: boolean;
  private useLow: boolean;
  private useLowPass: boolean;
  private useReverb: boolean;
  private useDistortion: boolean;

  // disable for now: sounds muffled;
  private disableFilters = true;

  private _input: GainNode;
  private _output: AudioNode;
  private output2?: AudioNode;

  private _lowValue = 0.0;
  private _midValue = 0.0;
  private _highValue = 0.0;
  private _volumeValue = 70;
  private _panningValue = 0;

  private FREQ_MUL = 7000;
  private QUAL_MUL = 30;

  private context = Audio.context;
  private volumeGain: GainNode | undefined;
  private highGain: BiquadFilterNode | undefined;
  private midGain: BiquadFilterNode | undefined;
  private lowGain: BiquadFilterNode | undefined;
  private lowPassfilter: BiquadFilterNode | undefined;
  private reverb: ConvolverNode | undefined;
  private reverbGain: GainNode | undefined;
  private panner: StereoPannerNode | undefined;

  constructor(filters: Filters) {
    filters = filters || {
      volume: true,
      panning: true,
      high: false,
      mid: false,
      low: false,
      lowPass: false,
      reverb: false,
      distortion: false,
    };

    if (this.disableFilters) {
      filters = {
        volume: true,
        panning: true,
        high: false,
        mid: false,
        low: false,
        lowPass: false,
        reverb: false,
        distortion: false,
      };
    }

    this.useVolume = filters.volume;
    this.usePanning =
      filters.panning && Audio.context.createStereoPanner != null;
    this.useHigh = filters.high;
    this.useMid = filters.mid;
    this.useLow = filters.low;
    this.useLowPass = filters.lowPass;
    this.useReverb = filters.reverb;
    this.useDistortion = filters.distortion;

    // use a simple Gain as input so that we can leave this connected while changing filters
    this._input = this.context.createGain();
    this._input.gain.value = 1;
    this._output = this._input;
    this.init();
  }

  private connectFilters() {
    this._output = this._input;

    if (this.useHigh) {
      this.highGain = this.highGain || this.createHigh();
      this._output.connect(this.highGain);
      this._output = this.highGain;
    }

    if (this.useMid) {
      this.midGain = this.midGain || this.createMid();
      this._output.connect(this.midGain);
      this._output = this.midGain;
    }

    if (this.useLow) {
      this.lowGain = this.lowGain || this.createLow();
      this._output.connect(this.lowGain);
      this._output = this.lowGain;
    }

    if (this.useLowPass) {
      this.lowPassfilter = this.lowPassfilter || this.createLowPass();
      this._output.connect(this.lowPassfilter);
      this._output = this.lowPassfilter;
    }

    if (this.useReverb) {
      this.reverb = this.reverb || this.context.createConvolver();
      this.reverbGain = this.reverbGain || this.context.createGain();
      this.reverbGain.gain.value = 0;

      this._output.connect(this.reverbGain);
      this.reverbGain.connect(this.reverb);
      this.output2 = this.reverb;
    }

    if (this.useDistortion) {
      const distortion = this.context.createWaveShaper();
      distortion.curve = this.distortionCurve(400);
      distortion.oversample = "4x";
    }

    if (this.usePanning) {
      this.panner = this.panner || Audio.context.createStereoPanner();
      this._output.connect(this.panner);
      this._output = this.panner;
    }

    // always use volume as last node - never disconnect this

    this.volumeGain = this.volumeGain || this.context.createGain();
    this._output.connect(this.volumeGain);
    if (this.output2) this.output2.connect(this.volumeGain);
    this._output = this.volumeGain;
  }

  private disConnectFilter() {
    this._input.disconnect();
    if (this.highGain) this.highGain.disconnect();
    if (this.midGain) this.midGain.disconnect();
    if (this.lowGain) this.lowGain.disconnect();
    if (this.lowPassfilter) this.lowPassfilter.disconnect();
    if (this.reverbGain) this.reverbGain.disconnect();
    if (this.panner) this.panner.disconnect();
    this.output2 = undefined;
  }

  private createHigh() {
    const filter = this.context.createBiquadFilter();
    filter.type = "highshelf";
    filter.frequency.value = 3200.0;
    filter.gain.value = this._highValue;
    return filter;
  }

  private createMid() {
    const filter = this.context.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = 1000.0;
    filter.Q.value = 0.5;
    filter.gain.value = this._midValue;
    return filter;
  }

  private createLow() {
    const filter = this.context.createBiquadFilter();
    filter.type = "lowshelf";
    filter.frequency.value = 320.0;
    filter.gain.value = this._lowValue;
    return filter;
  }

  private createLowPass() {
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 5000;
    return filter;
  }

  init() {
    this.connectFilters();
    this.volumeValue(this._volumeValue);
  }

  private distortionCurve(amount: number): Float32Array {
    const k = typeof amount === "number" ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      let x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  lowValue(value: number): number | undefined {
    if (!this.useLow) return;
    if (!this.lowGain) {
      console.error("No low filter gain to change value!");
      return;
    }
    if (typeof value !== "undefined") {
      const maxRange = 20;
      this._lowValue = value;
      this.lowGain.gain.value = this._lowValue * maxRange;
    }
    return this._lowValue;
  }

  midValue(value: number): number | undefined {
    if (!this.useMid) return;
    if (!this.midGain) {
      console.error("No mid filter gain to change value!");
      return;
    }
    if (typeof value !== "undefined") {
      const maxRange = 20;
      this._midValue = value;
      this.midGain.gain.value = this._midValue * maxRange;
    }
    return this._midValue;
  }

  highValue(value: number): number | undefined {
    if (!this.useHigh) return;
    if (!this.highGain) {
      console.error("No highfilter gain to change value!");
      return;
    }
    if (typeof value !== "undefined") {
      const maxRange = 20;
      this._highValue = value;
      this.highGain.gain.value = this._highValue * maxRange;
    }
    return this._highValue;
  }

  lowPassFrequencyValue(value: number) {
    if (!this.useLowPass) return;
    if (!this.lowPassfilter) {
      console.error("No low pass filter available to change frequency value!");
      return;
    }
    // Clamp the frequency between the minimum value (40 Hz) and half of the
    // sampling rate.
    const minValue = 40;
    const maxValue = Audio.context.sampleRate / 2;
    // Logarithm (base 2) to compute how many octaves fall in the range.
    const numberOfOctaves = Math.log(maxValue / minValue) / Math.LN2;
    // Compute a multiplier from 0 to 1 based on an exponential scale.
    const multiplier = Math.pow(2, numberOfOctaves * (value - 1.0));
    // Get back to the frequency value between min and max.

    this.lowPassfilter.frequency.value = maxValue * multiplier;
  }

  lowPassQualityValue(value: number) {
    if (!this.useLowPass) return;
    if (!this.lowPassfilter) {
      console.error("No low pass filter available to change quality value!");
      return;
    }
    this.lowPassfilter.Q.value = value * this.QUAL_MUL;
  }

  reverbValue(value: number) {
    if (!this.useReverb) return;
    if (!this.reverb) {
      console.error("No reverb available to change value!");
      return;
    }
    if (!this.reverbGain) {
      console.error("No reverb gain available to change value!");
      return;
    }

    const reverb = this.reverb;
    if (!reverb.buffer) {
      const buffer = cachedAssets.audio["data/reverb/sportcentre.m4a"];
      if (!buffer) {
        const preLoader = new PreLoader();
        preLoader.load(
          ["data/reverb/sportcentre.m4a"],
          PRELOADTYPE.audio,
          function () {
            console.error("reverb buffer loaded");
            reverb.buffer = cachedAssets.audio[
              "data/reverb/sportcentre.m4a"
            ] as AudioBuffer;
          },
        );
      } else {
        reverb.buffer = buffer;
      }
    }

    const max = 100;
    const fraction = value / max; // parseInt(value) / max
    this.reverbGain.gain.value = fraction * fraction;
  }

  volumeValue(value?: number): number | void {
    if (!this.useVolume) return;
    if (!this.volumeGain) {
      console.error("No volume gain to change value!");
      return;
    }
    if (typeof value !== "undefined") {
      const max = 100;
      this._volumeValue = value;
      const fraction = value / max;
      this.volumeGain.gain.value = fraction * fraction;
    }
    return this._volumeValue;
  }

  panningValue(value: number, time?: number) {
    if (!this.usePanning) return;
    if (!this.panner) {
      console.error("No panner to pan with!");
      return;
    }

    if (typeof value !== "undefined") {
      this._panningValue = value;
      if (time) {
        this.panner.pan.setValueAtTime(this._panningValue, time);
      } else {
        // very weird bug in safari on OSX ... setting pan.value directy to 0 does not work
        this.panner.pan.setValueAtTime(
          this._panningValue,
          Audio.context.currentTime,
        );
      }
    }
    return this._panningValue;
  }

  setState(name: string, value: boolean) {
    this.disConnectFilter();

    if (name === "high") this.useHigh = !!value;
    if (name === "mid") this.useMid = !!value;
    if (name === "low") this.useLow = !!value;
    if (name === "lowPass") this.useLowPass = !!value;
    if (name === "reverb") this.useReverb = !!value;
    if (name === "panning")
      this.usePanning = !!value && Audio.context.createStereoPanner != null;

    this.connectFilters();
  }

  input(): GainNode {
    return this._input;
  }

  output(): AudioNode {
    return this._output;
  }
}
