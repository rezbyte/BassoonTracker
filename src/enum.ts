type CachedAssets = {
  images: Record<string, object>;
  audio: Record<string, AudioBuffer | undefined>;
  json: Record<string, unknown>;
  arrayBuffer: Record<string, ArrayBuffer>;
  darkPanel: HTMLCanvasElement | undefined;
};
export const cachedAssets: CachedAssets = {
  images: {},
  audio: {},
  json: {},
  arrayBuffer: {},
  darkPanel: undefined,
};

export const sprites = {};
//export let UI = undefined;

export const enum PRELOADTYPE {
  image,
  audio,
  json,
  binary,
}

export const enum EVENT {
  instrumentChange,
  patternChange,
  patternPosChange,
  patternTableChange,
  recordingChange,
  cursorPositionChange,
  trackStateChange,
  playingChange,
  playTypeChange,
  songPositionChange,
  songSpeedChange,
  songBPMChange,
  samplePlay,
  screenRefresh,
  screenRender,
  songPropertyChange,
  instrumentNameChange,
  command,
  pianoNoteOn,
  pianoNoteOff,
  statusChange,
  diskOperationTargetChange,
  diskOperationActionChange,
  trackCountChange,
  patternHorizontalScrollChange,
  songLoaded,
  songLoading,
  trackerModeChanged,
  instrumentListChange,
  showView,
  toggleView,
  visibleTracksCountChange,
  filterChainCountChange,
  fxPanelToggle,
  samplePropertyChange,
  sampleIndexChange,
  second,
  minute,
  dropboxConnect,
  dropboxConnectCancel,
  trackScopeClick,
  octaveChanged,
  skipFrameChanged,
  showContextMenu,
  hideContextMenu,
  clockEventExpired,
  commandUndo,
  commandRedo,
  commandSelectAll,
  songEnd,
  patternEnd,
  songSpeedChangeIgnored,
  songBPMChangeIgnored,
  commandProcessSample,
  pluginRenderHook,
  menuLayoutChanged,
  midiIn,
}

export const enum COMMAND {
  newFile,
  openFile,
  saveFile,
  clearTrack,
  clearPattern,
  clearSong,
  clearInstruments,
  showMain,
  showOptions,
  showFileOperations,
  showSampleEditor,
  showAbout,
  showHelp,
  togglePiano,
  showTopMain,
  showBottomMain,
  randomSong,
  randomSongXM,
  showGithub,
  showStats,
  cut,
  copy,
  paste,
  pattern2Sample,
  toggleAppSideBar,
  undo,
  redo,
  nibbles,
  generator,
}

export function commandFromString(command: string): COMMAND | null {
  switch (command) {
    case "newFile":
      return COMMAND.newFile;
    case "openFile":
      return COMMAND.openFile;
    case "saveFile":
      return COMMAND.saveFile;
    case "clearTrack":
      return COMMAND.clearTrack;
    case "clearPattern":
      return COMMAND.clearPattern;
    case "clearSong":
      return COMMAND.clearSong;
    case "clearInstruments":
      return COMMAND.clearInstruments;
    case "showMain":
      return COMMAND.showMain;
    case "showOptions":
      return COMMAND.showOptions;
    case "showFileOperations":
      return COMMAND.showFileOperations;
    case "showSampleEditor":
      return COMMAND.showSampleEditor;
    case "showAbout":
      return COMMAND.showAbout;
    case "showHelp":
      return COMMAND.showHelp;
    case "togglePiano":
      return COMMAND.togglePiano;
    case "showTopMain":
      return COMMAND.showTopMain;
    case "showBottomMain":
      return COMMAND.showBottomMain;
    case "randomSong":
      return COMMAND.randomSong;
    case "randomSongXM":
      return COMMAND.randomSongXM;
    case "showGithub":
      return COMMAND.showGithub;
    case "showStats":
      return COMMAND.showStats;
    case "cut":
      return COMMAND.cut;
    case "copy":
      return COMMAND.copy;
    case "paste":
      return COMMAND.paste;
    case "pattern2Sample":
      return COMMAND.pattern2Sample;
    case "toggleAppSideBar":
      return COMMAND.toggleAppSideBar;
    case "undo":
      return COMMAND.undo;
    case "redo":
      return COMMAND.redo;
    case "nibbles":
      return COMMAND.nibbles;
    case "generator":
      return COMMAND.generator;
    default:
      return null;
  }
}

export const enum VIEW {
  main,
  options,
  fileOperations,
  sampleEditor,
  about,
  help,
  topMain,
  bottomMain,
  fileOperationsOpenFile,
  fileOperationsSaveFile,
  fileOperationsLoadSample,
  fileOperationsSaveSample,
  fileOperationsLoadModule,
  fileOperationsSaveModule,
  piano,
  appSideBar,
  custom, // Used for plugins such as Nibbles
}

export const enum PLAYTYPE {
  song,
  pattern,
}

export const enum FILETYPE {
  module,
  sample,
  pattern,
  track,
}

export const enum MODULETYPE {
  mod,
  xm,
}

export const enum SAMPLETYPE {
  RAW_8BIT,
  WAVE_PCM,
  IFF_8SVX,
  MP3,
  MP4,
  RIFF_8BIT,
  RIFF_16BIT,
  FLAC,
  OGG,
  OPUS,
}

export const enum STEREOSEPARATION {
  FULL,
  BALANCED,
  NONE,
}

export const enum FREQUENCYTABLE {
  AMIGA,
  LINEAR,
}

export const enum LOOPTYPE {
  NONE,
  FORWARD,
  PINGPONG,
}

export const enum SELECTION {
  RESET,
  CLEAR,
  CUT,
  COPY,
  PASTE,
  POSITION,
  DELETE,
  REPLACE,
}

export const enum EDITACTION {
  PATTERN,
  TRACK,
  NOTE,
  RANGE,
  VALUE,
  DATA,
  SAMPLE,
}

// Amiga Frequency
//var PALFREQUENCY = 7093789.2;
export const AMIGA_PALFREQUENCY = 7093790; // not that my ears can hear the difference but this seems to be the correct value  ftp://ftp.modland.com/pub/documents/format_documentation/Protracker%20effects%20(MODFIL12.TXT)%20(.mod).txt

// Frequency used by Fast Tracker in Amiga mode
export const PC_FREQUENCY = 7158728;

export const AMIGA_PALFREQUENCY_HALF = AMIGA_PALFREQUENCY / 2;
export const PC_FREQUENCY_HALF = PC_FREQUENCY / 2;

export const enum LAYOUTS {
  column4 = 4,
  column5 = 5,
  column5Full = 6,
  column6 = 7,
}

export interface NotePeriod {
  period: number;
  name: string;
  tune: number[];
}

// used in Protracker mode
export const NOTEPERIOD: Record<string, NotePeriod> = {
  C1: {
    period: 856,
    name: "C-1",
    tune: [
      907, 900, 894, 887, 881, 875, 868, 862, 856, 850, 844, 838, 832, 826, 820,
      814,
    ],
  },
  Cs1: {
    period: 808,
    name: "C#1",
    tune: [
      856, 850, 844, 838, 832, 826, 820, 814, 808, 802, 796, 791, 785, 779, 774,
      768,
    ],
  },
  D1: {
    period: 762,
    name: "D-1",
    tune: [
      808, 802, 796, 791, 785, 779, 774, 768, 762, 757, 752, 746, 741, 736, 730,
      725,
    ],
  },
  Ds1: {
    period: 720,
    name: "D#1",
    tune: [
      762, 757, 752, 746, 741, 736, 730, 725, 720, 715, 709, 704, 699, 694, 689,
      684,
    ],
  },
  E1: {
    period: 678,
    name: "E-1",
    tune: [
      720, 715, 709, 704, 699, 694, 689, 684, 678, 674, 670, 665, 660, 655, 651,
      646,
    ],
  },
  F1: {
    period: 640,
    name: "F-1",
    tune: [
      678, 675, 670, 665, 660, 655, 651, 646, 640, 637, 632, 628, 623, 619, 614,
      610,
    ],
  },
  Fs1: {
    period: 604,
    name: "F#1",
    tune: [
      640, 636, 632, 628, 623, 619, 614, 610, 604, 601, 597, 592, 588, 584, 580,
      575,
    ],
  },
  G1: {
    period: 570,
    name: "G-1",
    tune: [
      604, 601, 597, 592, 588, 584, 580, 575, 570, 567, 563, 559, 555, 551, 547,
      543,
    ],
  },
  Gs1: {
    period: 538,
    name: "G#1",
    tune: [
      570, 567, 563, 559, 555, 551, 547, 543, 538, 535, 532, 528, 524, 520, 516,
      513,
    ],
  },
  A1: {
    period: 508,
    name: "A-1",
    tune: [
      538, 535, 532, 528, 524, 520, 516, 513, 508, 505, 502, 498, 495, 491, 487,
      484,
    ],
  },
  As1: {
    period: 480,
    name: "A#1",
    tune: [
      508, 505, 502, 498, 494, 491, 487, 484, 480, 477, 474, 470, 467, 463, 460,
      457,
    ],
  },
  B1: {
    period: 453,
    name: "B-1",
    tune: [
      480, 477, 474, 470, 467, 463, 460, 457, 453, 450, 447, 444, 441, 437, 434,
      431,
    ],
  },
  C2: {
    period: 428,
    name: "C-2",
    tune: [
      453, 450, 447, 444, 441, 437, 434, 431, 428, 425, 422, 419, 416, 413, 410,
      407,
    ],
  },
  Cs2: {
    period: 404,
    name: "C#2",
    tune: [
      428, 425, 422, 419, 416, 413, 410, 407, 404, 401, 398, 395, 392, 390, 387,
      384,
    ],
  },
  D2: {
    period: 381,
    name: "D-2",
    tune: [
      404, 401, 398, 395, 392, 390, 387, 384, 381, 379, 376, 373, 370, 368, 365,
      363,
    ],
  },
  Ds2: {
    period: 360,
    name: "D#2",
    tune: [
      381, 379, 376, 373, 370, 368, 365, 363, 360, 357, 355, 352, 350, 347, 345,
      342,
    ],
  },
  E2: {
    period: 339,
    name: "E-2",
    tune: [
      360, 357, 355, 352, 350, 347, 345, 342, 339, 337, 335, 332, 330, 328, 325,
      323,
    ],
  },
  F2: {
    period: 320,
    name: "F-2",
    tune: [
      339, 337, 335, 332, 330, 328, 325, 323, 320, 318, 316, 314, 312, 309, 307,
      305,
    ],
  },
  Fs2: {
    period: 302,
    name: "F#2",
    tune: [
      320, 318, 316, 314, 312, 309, 307, 305, 302, 300, 298, 296, 294, 292, 290,
      288,
    ],
  },
  G2: {
    period: 285,
    name: "G-2",
    tune: [
      302, 300, 298, 296, 294, 292, 290, 288, 285, 284, 282, 280, 278, 276, 274,
      272,
    ],
  },
  Gs2: {
    period: 269,
    name: "G#2",
    tune: [
      285, 284, 282, 280, 278, 276, 274, 272, 269, 268, 266, 264, 262, 260, 258,
      256,
    ],
  },
  A2: {
    period: 254,
    name: "A-2",
    tune: [
      269, 268, 266, 264, 262, 260, 258, 256, 254, 253, 251, 249, 247, 245, 244,
      242,
    ],
  },
  As2: {
    period: 240,
    name: "A#2",
    tune: [
      254, 253, 251, 249, 247, 245, 244, 242, 240, 239, 237, 235, 233, 232, 230,
      228,
    ],
  },
  B2: {
    period: 226,
    name: "B-2",
    tune: [
      240, 238, 237, 235, 233, 232, 230, 228, 226, 225, 224, 222, 220, 219, 217,
      216,
    ],
  },
  C3: {
    period: 214,
    name: "C-3",
    tune: [
      226, 225, 223, 222, 220, 219, 217, 216, 214, 213, 211, 209, 208, 206, 205,
      204,
    ],
  },
  Cs3: {
    period: 202,
    name: "C#3",
    tune: [
      214, 212, 211, 209, 208, 206, 205, 203, 202, 201, 199, 198, 196, 195, 193,
      192,
    ],
  },
  D3: {
    period: 190,
    name: "D-3",
    tune: [
      202, 200, 199, 198, 196, 195, 193, 192, 190, 189, 188, 187, 185, 184, 183,
      181,
    ],
  },
  Ds3: {
    period: 180,
    name: "D#3",
    tune: [
      190, 189, 188, 187, 185, 184, 183, 181, 180, 179, 177, 176, 175, 174, 172,
      171,
    ],
  },
  E3: {
    period: 170,
    name: "E-3",
    tune: [
      180, 179, 177, 176, 175, 174, 172, 171, 170, 169, 167, 166, 165, 164, 163,
      161,
    ],
  },
  F3: {
    period: 160,
    name: "F-3",
    tune: [
      170, 169, 167, 166, 165, 164, 163, 161, 160, 159, 158, 157, 156, 155, 154,
      152,
    ],
  },
  Fs3: {
    period: 151,
    name: "F#3",
    tune: [
      160, 159, 158, 157, 156, 155, 154, 152, 151, 150, 149, 148, 147, 146, 145,
      144,
    ],
  },
  G3: {
    period: 143,
    name: "G-3",
    tune: [
      151, 150, 149, 148, 147, 146, 145, 144, 143, 142, 141, 140, 139, 138, 137,
      136,
    ],
  },
  Gs3: {
    period: 135,
    name: "G#3",
    tune: [
      143, 142, 141, 140, 139, 138, 137, 136, 135, 134, 133, 132, 131, 130, 129,
      128,
    ],
  },
  A3: {
    period: 127,
    name: "A-3",
    tune: [
      135, 134, 133, 132, 131, 130, 129, 128, 127, 126, 125, 125, 124, 123, 122,
      121,
    ],
  },
  As3: {
    period: 120,
    name: "A#3",
    tune: [
      127, 126, 125, 125, 123, 123, 122, 121, 120, 119, 118, 118, 117, 116, 115,
      114,
    ],
  },
  B3: {
    period: 113,
    name: "B-3",
    tune: [
      120, 119, 118, 118, 117, 116, 115, 114, 113, 113, 112, 111, 110, 109, 109,
      108,
    ],
  },
};

export interface FTNotePeriod {
  name: string;
  period: number;
  modPeriod?: number;
}

// used in Fasttracker - Amiga frequency mode
export const FTNOTEPERIOD: Record<string, FTNotePeriod> = {
  None: { name: "---", period: 0 }, //TODO Check if adding period broke it
  C0: { name: "C-0", period: 6848 },
  Cs0: { name: "C#0", period: 6464 },
  D0: { name: "D-0", period: 6096 },
  Ds0: { name: "D#0", period: 5760 },
  E0: { name: "E-0", period: 5424 },
  F0: { name: "F-0", period: 5120 },
  Fs0: { name: "F#0", period: 4832 },
  G0: { name: "G-0", period: 4560 },
  Gs0: { name: "G#0", period: 4304 },
  A0: { name: "A-0", period: 4064 },
  As0: { name: "A#0", period: 3840 },
  B0: { name: "B-0", period: 3624 },
  C1: { name: "C-1", period: 3424 },
  Cs1: { name: "C#1", period: 3232 },
  D1: { name: "D-1", period: 3048 },
  Ds1: { name: "D#1", period: 2880 },
  E1: { name: "E-1", period: 2712 },
  F1: { name: "F-1", period: 2560 },
  Fs1: { name: "F#1", period: 2416 },
  G1: { name: "G-1", period: 2280 },
  Gs1: { name: "G#1", period: 2152 },
  A1: { name: "A-1", period: 2032 },
  As1: { name: "A#1", period: 1920 },
  B1: { name: "B-1", period: 1812 },
  C2: { name: "C-2", period: 1712 },
  Cs2: { name: "C#2", period: 1616 },
  D2: { name: "D-2", period: 1524 },
  Ds2: { name: "D#2", period: 1440 },
  E2: { name: "E-2", period: 1356 },
  F2: { name: "F-2", period: 1280 },
  Fs2: { name: "F#2", period: 1208 },
  G2: { name: "G-2", period: 1140 },
  Gs2: { name: "G#2", period: 1076 },
  A2: { name: "A-2", period: 1016 },
  As2: { name: "A#2", period: 960 },
  B2: { name: "B-2", period: 906 },
  C3: { name: "C-3", period: 856 },
  Cs3: { name: "C#3", period: 808 },
  D3: { name: "D-3", period: 762 },
  Ds3: { name: "D#3", period: 720 },
  E3: { name: "E-3", period: 678 },
  F3: { name: "F-3", period: 640 },
  Fs3: { name: "F#3", period: 604 },
  G3: { name: "G-3", period: 570 },
  Gs3: { name: "G#3", period: 538 },
  A3: { name: "A-3", period: 508 },
  As3: { name: "A#3", period: 480 },
  B3: { name: "B-3", period: 453 },
  C4: { name: "C-4", period: 428 },
  Cs4: { name: "C#4", period: 404 },
  D4: { name: "D-4", period: 381 },
  Ds4: { name: "D#4", period: 360 },
  E4: { name: "E-4", period: 339 },
  F4: { name: "F-4", period: 320 },
  Fs4: { name: "F#4", period: 302 },
  G4: { name: "G-4", period: 285 },
  Gs4: { name: "G#4", period: 269 },
  A4: { name: "A-4", period: 254 },
  As4: { name: "A#4", period: 240 },
  B4: { name: "B-4", period: 226.5, modPeriod: 226 },
  C5: { name: "C-5", period: 214 },
  Cs5: { name: "C#5", period: 202 },
  D5: { name: "D-5", period: 190.5, modPeriod: 190 },
  Ds5: { name: "D#5", period: 180 },
  E5: { name: "E-5", period: 169.5, modPeriod: 170 },
  F5: { name: "F-5", period: 160 },
  Fs5: { name: "F#5", period: 151 },
  G5: { name: "G-5", period: 142.5, modPeriod: 143 },
  Gs5: { name: "G#5", period: 134.5, modPeriod: 135 },
  A5: { name: "A-5", period: 127 },
  As5: { name: "A#5", period: 120 },
  B5: { name: "B-5", period: 113.25, modPeriod: 113 },
  C6: { name: "C-6", period: 107 },
  Cs6: { name: "C#6", period: 101 },
  D6: { name: "D-6", period: 95.25, modPeriod: 95 },
  Ds6: { name: "D#6", period: 90 },
  E6: { name: "E-6", period: 84.75, modPeriod: 85 },
  F6: { name: "F-6", period: 80 },
  Fs6: { name: "F#6", period: 75.5, modPeriod: 75 },
  G6: { name: "G-6", period: 71.25, modPeriod: 71 },
  Gs6: { name: "G#6", period: 67.25, modPeriod: 67 },
  A6: { name: "A-6", period: 63.5, modPeriod: 63 },
  As6: { name: "A#6", period: 60 },
  B6: { name: "B-6", period: 56.625, modPeriod: 56 },
  C7: { name: "C-7", period: 53.5, modPeriod: 53 },
  Cs7: { name: "C#7", period: 50.5, modPeriod: 50 },
  D7: { name: "D-7", period: 47.625, modPeriod: 47 },
  Ds7: { name: "D#7", period: 45 },
  E7: { name: "E-7", period: 42.375, modPeriod: 42 },
  F7: { name: "F-7", period: 40 },
  Fs7: { name: "F#7", period: 37.75, modPeriod: 37 },
  G7: { name: "G-7", period: 35.625, modPeriod: 35 },
  Gs7: { name: "G#7", period: 33.625, modPeriod: 33 },
  A7: { name: "A-7", period: 31.75, modPeriod: 31 },
  As7: { name: "A#7", period: 30 },
  B7: { name: "B-7", period: 28.3125, modPeriod: 28 },

  // not used in fileformat but can be played through transposed notes
  C8: { name: "C-8", period: 26.75 },
  Cs8: { name: "C#8", period: 25.25 },
  D8: { name: "D-8", period: 23.8125 },
  Ds8: { name: "D#8", period: 22.5 },
  E8: { name: "E-8", period: 21.1875 },
  F8: { name: "F-8", period: 20 },
  Fs8: { name: "F#8", period: 18.875 },
  G8: { name: "G-8", period: 17.8125 },
  Gs8: { name: "G#8", period: 16.8125 },
  A8: { name: "A-8", period: 15.875 },
  As8: { name: "A#8", period: 15 },
  B8: { name: "B-8", period: 14.15625 },
  C9: { name: "C-9", period: 13.375 },
  Cs9: { name: "C#9", period: 12.625 },
  D9: { name: "D-9", period: 11.90625 },
  Ds9: { name: "D#9", period: 11.25 },
  E9: { name: "E-9", period: 10.59375 },
  F9: { name: "F-9", period: 10 },
  Fs9: { name: "F#9", period: 9.4375 },
  G9: { name: "G-9", period: 8.90625 },
  Gs9: { name: "G#9", period: 8.40625 },
  A9: { name: "A-9", period: 7.9375 },
  As9: { name: "A#9", period: 7.5 },
  B9: { name: "B-9", period: 7.078125 },
  C10: { name: "C-10", period: 6.6875 },
  Cs10: { name: "C#10", period: 6.3125 },
  D10: { name: "D-10", period: 5.953125 },
  Ds10: { name: "D#10", period: 5.625 },
  E10: { name: "E-10", period: 5.296875 },
  F10: { name: "F-10", period: 5 },
  Fs10: { name: "F#10", period: 4.71875 },
  G10: { name: "G-10", period: 4.453125 },
  Gs10: { name: "G#10", period: 4.203125 },
  A10: { name: "A-10", period: 3.96875 },
  As10: { name: "A#10", period: 3.75 },
  B10: { name: "B-10", period: 3.5390625 },
  C11: { name: "C-11", period: 3.34375 },
  Cs11: { name: "C#11", period: 3.15625 },
  D11: { name: "D-11", period: 2.9765625 },
  Ds11: { name: "D#11", period: 2.8125 },
  E11: { name: "E-11", period: 2.6484375 },
  F11: { name: "F-11", period: 2.5 },
  Fs11: { name: "F#11", period: 2.359375 },
  G11: { name: "G-11", period: 2.2265625 },
  Gs11: { name: "G#11", period: 2.1015625 },
  A11: { name: "A-11", period: 1.984375 },
  As11: { name: "A#11", period: 1.875 },
  B11: { name: "B-11", period: 1.76953125 },

  OFF: { name: "OFF", period: 0 },
};

export const NOTEOFF = 145;

export const enum KEYBOARDKEYS {
  OFF,
  C,
  Csharp,
  D,
  Dsharp,
  E,
  F,
  Fsharp,
  G,
  Gsharp,
  A,
  Asharp,
  B,
  COctaveUp,
  CsharpOctaveUp,
  DOctaveUp,
  DsharpOctaveUp,
  EOctaveUp,
  FOctaveUp,
  FsharpOctaveUp,
  GOctaveUp,
  GsharpOctaveUp,
  AOctaveUp,
  AsharpOctaveUp,
  BOctaveUp,
  COctaveUp2,
  CsharpOctaveUp2,
  DOctaveUp2,
}

export const OCTAVENOTES: Record<number, { name: string }> = {
  0: { name: "OFF" },
  1: { name: "C" },
  2: { name: "Cs" },
  3: { name: "D" },
  4: { name: "Ds" },
  5: { name: "E" },
  6: { name: "F" },
  7: { name: "Fs" },
  8: { name: "G" },
  9: { name: "Gs" },
  10: { name: "A" },
  11: { name: "As" },
  12: { name: "B" },
};

export const KEYBOARDTABLE: Record<string, Record<string, KEYBOARDKEYS>> = {
  azerty: {
    a: KEYBOARDKEYS.COctaveUp,
    z: KEYBOARDKEYS.DOctaveUp,
    e: KEYBOARDKEYS.EOctaveUp,
    r: KEYBOARDKEYS.FOctaveUp,
    t: KEYBOARDKEYS.GOctaveUp,
    y: KEYBOARDKEYS.AOctaveUp,
    u: KEYBOARDKEYS.BOctaveUp,
    i: KEYBOARDKEYS.COctaveUp2,
    o: KEYBOARDKEYS.DOctaveUp2,

    é: KEYBOARDKEYS.CsharpOctaveUp,
    '"': KEYBOARDKEYS.DsharpOctaveUp,
    "(": KEYBOARDKEYS.FsharpOctaveUp,
    "§": KEYBOARDKEYS.GsharpOctaveUp,
    è: KEYBOARDKEYS.AsharpOctaveUp,
    ç: KEYBOARDKEYS.CsharpOctaveUp2,

    w: KEYBOARDKEYS.C,
    x: KEYBOARDKEYS.D,
    c: KEYBOARDKEYS.E,
    v: KEYBOARDKEYS.F,
    b: KEYBOARDKEYS.G,
    n: KEYBOARDKEYS.A,
    ",": KEYBOARDKEYS.B,
    ";": KEYBOARDKEYS.COctaveUp,
    ":": KEYBOARDKEYS.DOctaveUp,

    s: KEYBOARDKEYS.Csharp,
    d: KEYBOARDKEYS.Dsharp,
    g: KEYBOARDKEYS.Fsharp,
    h: KEYBOARDKEYS.Gsharp,
    j: KEYBOARDKEYS.Asharp,

    "<": KEYBOARDKEYS.OFF,
  },
  dvorak: {
    "'": KEYBOARDKEYS.COctaveUp,
    ",": KEYBOARDKEYS.DOctaveUp,
    ".": KEYBOARDKEYS.EOctaveUp,
    p: KEYBOARDKEYS.FOctaveUp,
    y: KEYBOARDKEYS.GOctaveUp,
    f: KEYBOARDKEYS.AOctaveUp,
    g: KEYBOARDKEYS.BOctaveUp,
    c: KEYBOARDKEYS.COctaveUp2,
    r: KEYBOARDKEYS.DOctaveUp2,

    "2": KEYBOARDKEYS.CsharpOctaveUp,
    "3": KEYBOARDKEYS.DsharpOctaveUp,
    "5": KEYBOARDKEYS.FsharpOctaveUp,
    "6": KEYBOARDKEYS.GsharpOctaveUp,
    "7": KEYBOARDKEYS.AsharpOctaveUp,
    "9": KEYBOARDKEYS.CsharpOctaveUp2,

    ";": KEYBOARDKEYS.C,
    q: KEYBOARDKEYS.D,
    j: KEYBOARDKEYS.E,
    k: KEYBOARDKEYS.F,
    x: KEYBOARDKEYS.G,
    b: KEYBOARDKEYS.A,
    m: KEYBOARDKEYS.B,
    w: KEYBOARDKEYS.COctaveUp,
    v: KEYBOARDKEYS.DOctaveUp,

    o: KEYBOARDKEYS.Csharp,
    e: KEYBOARDKEYS.Dsharp,
    i: KEYBOARDKEYS.Fsharp,
    d: KEYBOARDKEYS.Gsharp,
    h: KEYBOARDKEYS.Asharp,
    n: KEYBOARDKEYS.CsharpOctaveUp,

    "\\": KEYBOARDKEYS.OFF,
  },
  qwerty: {
    q: KEYBOARDKEYS.COctaveUp,
    w: KEYBOARDKEYS.DOctaveUp,
    e: KEYBOARDKEYS.EOctaveUp,
    r: KEYBOARDKEYS.FOctaveUp,
    t: KEYBOARDKEYS.GOctaveUp,
    y: KEYBOARDKEYS.AOctaveUp,
    u: KEYBOARDKEYS.BOctaveUp,
    i: KEYBOARDKEYS.COctaveUp2,
    o: KEYBOARDKEYS.DOctaveUp2,

    "2": KEYBOARDKEYS.CsharpOctaveUp,
    "3": KEYBOARDKEYS.DsharpOctaveUp,
    "5": KEYBOARDKEYS.FsharpOctaveUp,
    "6": KEYBOARDKEYS.GsharpOctaveUp,
    "7": KEYBOARDKEYS.AsharpOctaveUp,
    "9": KEYBOARDKEYS.CsharpOctaveUp2,

    z: KEYBOARDKEYS.C,
    x: KEYBOARDKEYS.D,
    c: KEYBOARDKEYS.E,
    v: KEYBOARDKEYS.F,
    b: KEYBOARDKEYS.G,
    n: KEYBOARDKEYS.A,
    m: KEYBOARDKEYS.B,
    ",": KEYBOARDKEYS.COctaveUp,
    ".": KEYBOARDKEYS.DOctaveUp,

    s: KEYBOARDKEYS.Csharp,
    d: KEYBOARDKEYS.Dsharp,
    g: KEYBOARDKEYS.Fsharp,
    h: KEYBOARDKEYS.Gsharp,
    j: KEYBOARDKEYS.Asharp,

    "\\": KEYBOARDKEYS.OFF,
  },
  qwertz: {
    q: KEYBOARDKEYS.COctaveUp,
    w: KEYBOARDKEYS.DOctaveUp,
    e: KEYBOARDKEYS.EOctaveUp,
    r: KEYBOARDKEYS.FOctaveUp,
    t: KEYBOARDKEYS.GOctaveUp,
    z: KEYBOARDKEYS.AOctaveUp,
    u: KEYBOARDKEYS.BOctaveUp,
    i: KEYBOARDKEYS.COctaveUp2,
    o: KEYBOARDKEYS.DOctaveUp2,

    "2": KEYBOARDKEYS.CsharpOctaveUp,
    "3": KEYBOARDKEYS.DsharpOctaveUp,
    "5": KEYBOARDKEYS.FsharpOctaveUp,
    "6": KEYBOARDKEYS.GsharpOctaveUp,
    "7": KEYBOARDKEYS.AsharpOctaveUp,
    "9": KEYBOARDKEYS.CsharpOctaveUp2,

    y: KEYBOARDKEYS.C,
    x: KEYBOARDKEYS.D,
    c: KEYBOARDKEYS.E,
    v: KEYBOARDKEYS.F,
    b: KEYBOARDKEYS.G,
    n: KEYBOARDKEYS.A,
    m: KEYBOARDKEYS.B,
    ",": KEYBOARDKEYS.COctaveUp,
    ".": KEYBOARDKEYS.DOctaveUp,

    s: KEYBOARDKEYS.Csharp,
    d: KEYBOARDKEYS.Dsharp,
    g: KEYBOARDKEYS.Fsharp,
    h: KEYBOARDKEYS.Gsharp,
    j: KEYBOARDKEYS.Asharp,

    "\\": KEYBOARDKEYS.OFF,
  },
};

export const enum TRACKERMODE {
  PROTRACKER,
  FASTTRACKER,
}
