import { EVENT } from "../../enum";
import EventBus from "../../eventBus";
import { UI } from "../main";
import Tracker from "../../tracker";
import BitmapFont from "../components/bitmapfont";

class Layout {
  defaultMargin: number = 4;
  showAppSideBar: boolean = false;
  width: number = 0;
  height: number = 0;
  sidebarWidth: number = 0;
  col1W: number = 0;
  col2W: number = 0;
  col3W: number = 0;
  col4W: number = 0;
  col5W: number = 0;
  marginLeft: number = 0;
  marginRight: number = 0;
  mainLeft: number = this.sidebarWidth;
  mainWidth: number = 0;
  col1X: number = 0;
  col2X: number = 0;
  col3X: number = 0;
  col4X: number = 0;
  col5X: number = 0;
  colHalfW: number = 0;
  col31W: number = 0;
  col32W: number = 0;
  col31X: number = 0;
  col32X: number = 0;
  col33X: number = 0;
  prefered: string = "col5";
  controlPanelHeight: number = 40;
  controlPanelLayout: string = "full";
  controlPanelButtonLayout: string = "1row";
  controlPanelButtonsLeft: number = 0;
  controlPanelButtonsWidth: number = 0;
  modeButtonsWidth: number = 0;
  modeButtonsLeft: number = 0;
  songControlWidth: number = 0;
  TrackCountSpinboxWidth: number = 60;
  trackWidth: number = 0;
  trackMargin: number = this.defaultMargin;
  visibleTracks: number = 4;
  infoPanelHeight: number = 24;
  trackControlHeight: number = 32;
  analyserHeight: number = 66;
  pianoHeight: number = 200;
  trackFont: BitmapFont | undefined;
  useCondensedTrackFont: boolean = false;
  maxVisibleTracks: number = 16;
  controlPanelButtonsButton: number = 0;
  showSideBar: boolean = false;
  firstTrackOffsetLeft: number = 0;
  expandSampleViewHeight: boolean = false;

  setLayout(w?: number, h?: number) {
    this.width = w || this.width;
    this.height = h || this.height;

    if (this.width === undefined) {
      console.error("Layout needs a width!");
      return;
    }
    if (this.height === undefined) {
      console.error("Layout needs a height!");
      return;
    }

    let mainWidth = this.width;

    this.sidebarWidth = this.showAppSideBar ? 200 : 0;

    // sidebar
    mainWidth = mainWidth - this.sidebarWidth;

    // 5 column layout
    this.col1W = Math.floor((mainWidth - 6 * this.defaultMargin - 3) / 5);
    this.col2W = this.col1W * 2 + this.defaultMargin;
    this.col3W = this.col1W * 3 + this.defaultMargin * 2;
    this.col4W = this.col1W * 4 + this.defaultMargin * 3;
    this.col5W = this.col1W * 5 + this.defaultMargin * 4;

    this.marginLeft = Math.floor((mainWidth - this.col5W) / 2);
    this.marginRight = mainWidth - this.marginLeft - this.col5W;

    this.mainLeft = this.sidebarWidth;
    this.mainWidth = mainWidth;

    this.col1X = this.marginLeft;
    this.col2X = this.col1X + this.defaultMargin + this.col1W;
    this.col3X = this.col2X + this.defaultMargin + this.col1W;
    this.col4X = this.col3X + this.defaultMargin + this.col1W;
    this.col5X = this.col4X + this.defaultMargin + this.col1W;

    this.colHalfW = Math.floor(this.col1W / 2);

    // 3 column layout
    this.col31W = Math.floor((mainWidth - 4 * this.defaultMargin - 5) / 3);
    this.col32W = this.col31W * 2 + this.defaultMargin;
    this.col31X = this.col1X;
    this.col32X = this.col31X + this.defaultMargin + this.col31W;
    this.col33X = this.col32X + this.defaultMargin + this.col31W;

    this.prefered = "col5";

    /* controlpanel */
    this.controlPanelHeight = 40;
    this.controlPanelLayout = "full";
    this.controlPanelButtonLayout = "1row";
    this.controlPanelButtonsLeft = this.col2X;
    this.controlPanelButtonsWidth = this.col3W;
    this.modeButtonsWidth = this.col1W;
    this.modeButtonsLeft = this.col5X;
    this.songControlWidth = this.col1W;
    this.TrackCountSpinboxWidth = 60;

    /* patternview */
    this.trackWidth = this.col1W;
    this.trackMargin = this.defaultMargin;
    this.visibleTracks = this.visibleTracks || 4;
    this.infoPanelHeight = 24;
    this.trackControlHeight = 32;
    this.analyserHeight = 66;
    this.pianoHeight = 200;
    this.trackFont = UI.fontMed;
    this.useCondensedTrackFont = false;

    this.maxVisibleTracks = 16;
    if (mainWidth < 945) this.maxVisibleTracks = 12;
    if (mainWidth < 725) this.maxVisibleTracks = 8;
    if (mainWidth < 512) this.maxVisibleTracks = 4;

    if (this.visibleTracks > this.maxVisibleTracks) {
      this.setVisibleTracks(this.maxVisibleTracks);
      return;
    }

    if (mainWidth < 820) {
      //this.controlPanelHeight = 80;
      this.controlPanelButtonLayout = "condensed";
      this.modeButtonsWidth = this.col1W + this.colHalfW;
      this.modeButtonsLeft = this.col5X - this.colHalfW;
      this.songControlWidth = this.modeButtonsWidth;
      this.controlPanelButtonsLeft = this.col2X + this.colHalfW;
      this.controlPanelButtonsWidth = this.col2W;
    }

    if (mainWidth < 650) {
      this.controlPanelButtonLayout = "2row";
      this.controlPanelHeight = 80;

      this.controlPanelButtonsLeft = this.col1X;
      this.controlPanelButtonsWidth = this.col5W;
      this.controlPanelButtonsButton = Math.floor(
        this.controlPanelButtonsWidth / 3,
      );

      this.modeButtonsLeft =
        this.controlPanelButtonsButton * 2 - this.TrackCountSpinboxWidth;
      this.modeButtonsWidth =
        this.controlPanelButtonsButton +
        this.TrackCountSpinboxWidth +
        this.defaultMargin;
      this.songControlWidth = this.col2W + this.colHalfW + this.defaultMargin;
    }

    if (mainWidth < 620) {
      this.prefered = "col3";
    }

    if (this.height < 800) {
      this.pianoHeight = 150;
    }

    if (this.height < 650) {
      this.pianoHeight = 100;
    }

    const margins = this.defaultMargin * (this.visibleTracks - 1);
    this.showSideBar = this.visibleTracks < 5 && mainWidth > 620;

    const totalWidth = this.showSideBar ? this.col4W : this.col5W;
    this.trackWidth = Math.floor((totalWidth - margins) / this.visibleTracks);

    this.firstTrackOffsetLeft = 0;
    if (this.trackWidth < 125) {
      this.firstTrackOffsetLeft = 18;
      this.trackWidth = Math.floor(
        (totalWidth - margins - this.firstTrackOffsetLeft) / this.visibleTracks,
      );
    }
    const minTrackWidth = Tracker.inFTMode() ? 100 : 78;
    if (this.trackWidth < minTrackWidth) {
      this.trackFont = UI.fontSuperCondensed;
      this.useCondensedTrackFont = true;
    }
  }

  setVisibleTracks(count: number) {
    this.visibleTracks = count;
    this.setLayout();
    EventBus.trigger(EVENT.visibleTracksCountChange, count);
  }
}
export default new Layout();
