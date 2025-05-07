export type WaveFormGenerator = (
  period: number,
  progress: number,
  freq: number,
  amp: number,
) => number;

const waveFormFunction = {
  sine: function (
    period: number,
    progress: number,
    freq: number,
    amp: number,
  ): number {
    return period + Math.sin(progress * freq * 0.8) * amp * 1.7;
    // I got the impression that this formaula is more like  amp * 2 in FT2
    // in Protracker a lookuptable is used - maybe we should adopt that
  },
  saw: function (
    period: number,
    progress: number,
    freq: number,
    amp: number,
  ): number {
    let value = 1 - Math.abs(((progress * freq) / 7) % 1); // from 1 to 0
    value = value * 2 - 1; // from -1 to 1
    value = value * amp * -2;
    return period + value;
  },
  square: function (
    period: number,
    progress: number,
    freq: number,
    amp: number,
  ): number {
    let value = Math.sin(progress * freq) <= 0 ? -1 : 1;
    value = value * amp * 2;
    return period + value;
  },
  sawInverse: function (
    period: number,
    progress: number,
    freq: number,
    amp: number,
  ): number {
    let value = Math.abs(((progress * freq) / 7) % 1); // from 0 to 1
    value = value * 2 - 1; // from -1 to 1
    value = value * amp * -2;
    return period + value;
  },
};

export default waveFormFunction;
