import { EVENT } from "../../enum";
import EventBus from "../../eventBus";
import { UI } from "../main";
import Tracker from "../../tracker";
import BitmapFont from "../components/bitmapfont";

class Layout {
  defaultMargin = 4;
  showAppSideBar = false;
  width = 0;
  height = 0;
  sidebarWidth = 0;
  col1W = 0;
  col2W = 0;
  col3W = 0;
  col4W = 0;
  col5W = 0;
  marginLeft = 0;
  marginRight = 0;
  mainLeft: number = this.sidebarWidth;
  mainWidth = 0;
  col1X = 0;
  col2X = 0;
  col3X = 0;
  col4X = 0;
  col5X = 0;
  colHalfW = 0;
  col31W = 0;
  col32W = 0;
  col31X = 0;
  col32X = 0;
  col33X = 0;
  prefered = "col5";
  controlPanelHeight = 40;
  controlPanelLayout = "full";
  controlPanelButtonLayout = "1row";
  controlPanelButtonsLeft = 0;
  controlPanelButtonsWidth = 0;
  modeButtonsWidth = 0;
  modeButtonsLeft = 0;
  songControlWidth = 0;
  TrackCountSpinboxWidth = 60;
  trackWidth = 0;
  trackMargin: number = this.defaultMargin;
  visibleTracks = 4;
  infoPanelHeight = 24;
  trackControlHeight = 32;
  analyserHeight = 66;
  pianoHeight = 200;
  trackFont: BitmapFont | undefined;
  useCondensedTrackFont = false;
  maxVisibleTracks = 16;
  controlPanelButtonsButton = 0;
  showSideBar = false;
  firstTrackOffsetLeft = 0;
  expandSampleViewHeight = false;

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
