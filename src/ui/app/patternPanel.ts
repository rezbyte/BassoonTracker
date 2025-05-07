import { EVENT, VIEW } from "../../enum";
import EventBus, { TrackStateChangeValue } from "../../eventBus";
import AppPanelContainer from "./panelContainer";
import Layout from "./layout";
import Tracker from "../../tracker";
import EditPanel from "../editPanel";
import InfoPanel from "../infopanel";
import Element from "../components/element";
import TrackControl from "./components/trackControl";
import Visualiser from "./components/visualiser";
import Audio from "../../audio";
import PatternSidebar from "./components/patternSidebar";
import AppPatternView from "./components/patternView";
import SampleView from "../sampleView";

export default class AppPatternPanel extends AppPanelContainer {
  private trackControls: TrackControl[];
  private patternTrackLeft: number = 0;
  private currentView: string;
  private editPanel: EditPanel;
  private infoPanel: InfoPanel;
  private visualiser: Visualiser;
  private scopesClickHandler: Element;
  private patternSidebar: PatternSidebar;
  private patternView: AppPatternView;
  private sampleView: SampleView;
  //private visibleTracks: number = 0;

  constructor() {
    // UI.app_patternPanel
    super(80);
    this.trackControls = [];
    const maxVisibleTracks = 4;
    this.currentView = "main";

    this.editPanel = new EditPanel();
    this.addChild(this.editPanel);

    this.infoPanel = new InfoPanel();
    this.addChild(this.infoPanel);

    for (let i = 0; i < Tracker.getTrackCount(); i++) {
      this.trackControls[i] = new TrackControl();
      this.addChild(this.trackControls[i]);
    }

    this.visualiser = new Visualiser();
    this.visualiser.connect(Audio.getCutOffVolume());
    this.visualiser.name = "mainAnalyser";

    this.scopesClickHandler = new Element();
    this.scopesClickHandler.render = (internal?: boolean) => {
      return undefined;
    };
    this.scopesClickHandler.onClick = (touchData) => {
      this.visualiser.onClick(touchData);
    };
    this.addChild(this.scopesClickHandler);

    this.patternSidebar = new PatternSidebar();
    this.addChild(this.patternSidebar);

    this.patternView = new AppPatternView();
    this.patternView.setProperties({
      name: "patternViewPanel",
    });
    this.addChild(this.patternView);

    this.sampleView = new SampleView();
    this.sampleView.setProperties({
      name: "sampleViewPanel",
    });
    this.addChild(this.sampleView);
    this.onPanelResize();

    EventBus.on(EVENT.patternChange, () => {
      this.patternView.refresh();
    });

    EventBus.on(EVENT.patternPosChange, () => {
      this.patternView.refresh();
    });
    EventBus.on(EVENT.cursorPositionChange, () => {
      this.patternView.refresh();
    });
    EventBus.on(EVENT.recordingChange, () => {
      this.patternView.refresh();
    });

    EventBus.on(EVENT.trackStateChange, (state: TrackStateChangeValue) => {
      // set other tracks to mute if a track is soloed

      if (typeof state.track != "undefined") {
        if (state.solo) {
          for (let i = 0; i < Tracker.getTrackCount(); i++) {
            if (i != state.track) {
              this.trackControls[i].setProperties({ mute: true });
            }
          }
        } else if (state.wasSolo) {
          for (let i = 0; i < Tracker.getTrackCount(); i++) {
            if (i != state.track) {
              this.trackControls[i].setProperties({ mute: false });
            }
          }
        }
      }
    });

    EventBus.on(EVENT.trackCountChange, (trackCount: number) => {
      //this.visibleTracks = Math.min(maxVisibleTracks, trackCount);

      for (let i = this.trackControls.length; i < trackCount; i++) {
        this.trackControls[i] = new TrackControl();
        this.trackControls[i].setProperties({
          track: i,
          top: -200,
        });
        this.addChild(this.trackControls[i]);
      }
      this.setTrackControlsLayout();
      this.refresh();
      this.visualiser.connect(Audio.getCutOffVolume());
    });

    EventBus.on(EVENT.patternHorizontalScrollChange, () => {
      // update track Controls ... shouldn't they be part of the patternView?
      this.setTrackControlsLayout();
    });

    EventBus.on(EVENT.showView, (view: VIEW) => {
      switch (view) {
        case VIEW.sampleEditor:
          this.sampleView.show();
          this.patternView.hide();
          this.patternSidebar.hide();

          if (Layout.expandSampleViewHeight) {
            this.visualiser.hide();
            this.editPanel.hide();
          }

          this.currentView = "sample";
          this.onPanelResize();
          this.refresh();
          break;
        case VIEW.bottomMain:
        case VIEW.main:
          this.sampleView.hide();
          this.patternView.show();
          this.visualiser.show();
          if (Layout.showSideBar) {
            this.patternSidebar.show();
            this.editPanel.show();
          }
          this.currentView = "main";
          this.onPanelResize();
          this.refresh();
          break;
      }
    });

    EventBus.on(EVENT.visibleTracksCountChange, (count: number) => {
      if (Layout.showSideBar) {
        if (this.currentView === "main") {
          this.patternSidebar.show();
          this.editPanel.show();
        }
      } else {
        this.patternSidebar.hide();
        this.editPanel.hide();
      }
      this.onResize();
    });
  }

  onPanelResize() {
    if (Layout.showSideBar) {
      if (this.currentView === "main") {
        this.patternSidebar.show();
        this.editPanel.show();
      }
    } else {
      this.patternSidebar.hide();
      this.editPanel.hide();
    }

    const patternTop =
      Layout.infoPanelHeight +
      Layout.trackControlHeight +
      Layout.analyserHeight +
      Layout.defaultMargin * 2;
    const patternHeight = this.height - patternTop - Layout.defaultMargin;

    Layout.expandSampleViewHeight = patternHeight < 280;

    if (Layout.expandSampleViewHeight && this.currentView === "sample") {
      this.visualiser.hide();
      this.editPanel.hide();
    } else {
      this.visualiser.show();
      if (Layout.showSideBar) this.editPanel.show();
    }

    const patternLeft = Layout.showSideBar ? Layout.col2X : Layout.col1X;
    const patternWidth = Layout.showSideBar ? Layout.col4W : Layout.col5W;

    this.patternTrackLeft = patternLeft + Layout.firstTrackOffsetLeft;

    this.editPanel.setDimensions({
      left: Layout.col1X,
      top: Layout.defaultMargin,
      width: Layout.col1W,
      height: Layout.infoPanelHeight + Layout.analyserHeight,
    });

    this.infoPanel.setDimensions({
      left: Layout.showSideBar ? Layout.col2X : Layout.col1X,
      top: 0,
      width: Layout.showSideBar ? Layout.col4W : Layout.col5W,
      height: Layout.infoPanelHeight,
    });

    this.patternView.setDimensions({
      left: patternLeft,
      top: patternTop,
      width: patternWidth,
      height: patternHeight,
    });

    this.patternSidebar.setDimensions({
      left: Layout.col1X,
      top: this.patternView.top - Layout.trackControlHeight, // top: this.patternView.top - Layout.trackControlHeight,
      width: Layout.col1W,
      height: patternHeight + Layout.trackControlHeight,
    });

    this.visualiser.setProperties({
      left: this.patternTrackLeft + Layout.mainLeft,
      top: this.top + Layout.infoPanelHeight + 3,
      width: patternWidth - Layout.firstTrackOffsetLeft,
      height: Layout.analyserHeight,
    });

    this.scopesClickHandler.setDimensions({
      left: this.visualiser.left - Layout.mainLeft,
      top: Layout.infoPanelHeight + 3,
      width: this.visualiser.width,
      height: this.visualiser.height,
    });

    this.sampleView.setProperties({
      left: 0,
      top: Layout.expandSampleViewHeight ? Layout.infoPanelHeight : patternTop,
      width: this.width,
      height: Layout.expandSampleViewHeight
        ? this.height - Layout.infoPanelHeight - Layout.defaultMargin - 3
        : patternHeight,
    });

    this.setTrackControlsLayout();
  }

  private setTrackControlsLayout() {
    // controlBar
    const startTrack = this.patternView.getStartTrack();
    const endTrack = Math.min(
      startTrack + Layout.visibleTracks,
      Tracker.getTrackCount(),
    );

    const isVisible = !(
      Layout.expandSampleViewHeight && this.currentView === "sample"
    );

    for (let i = 0; i < this.trackControls.length; i++) {
      if (i >= startTrack && i < endTrack) {
        this.trackControls[i].setProperties({
          track: i,
          left:
            this.patternTrackLeft +
            (Layout.trackWidth + Layout.trackMargin) * (i - startTrack),
          top:
            Layout.defaultMargin +
            Layout.infoPanelHeight +
            Layout.analyserHeight,
          width: Layout.trackWidth,
          height: Layout.trackControlHeight,
          visible: isVisible,
        });
      } else {
        this.trackControls[i].setProperties({
          track: i,
          top: -100,
          visible: false,
        });
      }
    }
  }
}
