import Panel from "./components/panel";
import { canvas } from "./main";
import EventBus, { ShowEventHandlerProperties } from "../eventBus";
import { EVENT, VIEW } from "../enum";
import Assets from "./assets";
import Menu, { MenuItem } from "./components/menu";
import Layout from "./app/layout";
import AppMenu from "./app/menu";
import AppSidebar from "./app/components/appSidebar";
import AppMainPanel from "./app/mainPanel";
import AppPianoView from "./app/pianoView";
import type DiskOperations from "./diskOperations";
import AppControlPanel from "./app/controlPanel";
import AppPatternPanel from "./app/patternPanel";

export default class MainPanel extends Panel {
  private contextMenus: Record<string, Menu>;
  private menu: AppMenu;
  private appPanel: AppMainPanel;
  private controlPanel: AppControlPanel;
  private patternPanel: AppPatternPanel;
  private pianoPanel: AppPianoView;
  private sidebar: AppSidebar;
  onResize: () => void;

  constructor() {
    // Formerly UI.MainPanel
    super(0, 0, canvas.width, canvas.height); // super(0,0,canvas.width,canvas.height,true);
    this.setProperties({
      backgroundColor: "#071028",
    });
    this.name = "mainPanel";

    this.contextMenus = {};

    this.menu = new AppMenu(this);
    this.addChild(this.menu);

    this.appPanel = new AppMainPanel();
    this.addChild(this.appPanel);

    this.controlPanel = new AppControlPanel();
    this.addChild(this.controlPanel);

    this.patternPanel = new AppPatternPanel();
    this.addChild(this.patternPanel);

    this.sidebar = new AppSidebar();
    if (Layout.showAppSideBar) {
      this.addChild(this.sidebar);
    }

    this.pianoPanel = new AppPianoView();
    this.pianoPanel.hide();
    this.addChild(this.pianoPanel);

    this.sortZIndex();
    this.onResize = this._onResize.bind(this);
    this.onResize();

    EventBus.on(EVENT.toggleView, (view: VIEW) => {
      if (view === VIEW.piano) {
        this.pianoPanel.toggle();
        let remaining = this.height - this.patternPanel.top;
        if (this.pianoPanel.isVisible()) {
          this.pianoPanel.setSize(Layout.mainWidth, Layout.pianoHeight);
          this.pianoPanel.setPosition(
            Layout.mainLeft,
            this.height - this.pianoPanel.height,
          );
          remaining = remaining - this.pianoPanel.height;
        }
        this.patternPanel.setSize(Layout.mainWidth, remaining);
      }

      if (view === VIEW.appSideBar) {
        Layout.showAppSideBar = !Layout.showAppSideBar;
        Layout.setLayout();
        this.onResize();
      }
    });

    EventBus.on(
      EVENT.showContextMenu,
      (properties: ShowEventHandlerProperties) => {
        const contextMenu = this.createContextMenu(properties);
        let x = properties.x;
        if (x + contextMenu.width > Layout.mainWidth)
          x = Layout.mainWidth - contextMenu.width;
        contextMenu.setPosition(x, properties.y - contextMenu.height - 2);
        contextMenu.show();
        this.refresh();
      },
    );

    EventBus.on(EVENT.hideContextMenu, () => {
      for (const key in this.contextMenus) {
        this.contextMenus[key].hide();
      }
      this.refresh();
    });
  }

  createContextMenu(properties: {
    name: string | number;
    x: number;
    y: number;
    items: MenuItem[];
  }) {
    let contextMenu = this.contextMenus[properties.name];
    if (!contextMenu) {
      contextMenu = new Menu(100, 100, 128, 42, this);
      contextMenu.zIndex = 100;
      contextMenu.setProperties({
        background: Assets.panelMainScale9,
        layout: "buttons",
      });
      contextMenu.setItems(properties.items);
      contextMenu.hide();
      this.addChild(contextMenu);
      this.contextMenus[properties.name] = contextMenu;
    }
    return contextMenu;
  }

  _onResize() {
    Layout.setLayout(this.width, this.height);

    this.menu.setSize(Layout.mainWidth, this.menu.height);
    let panelTop = this.menu.height;

    this.appPanel.setSize(Layout.mainWidth, this.appPanel.height);
    this.appPanel.setPosition(Layout.mainLeft, panelTop);
    panelTop += this.appPanel.height;

    this.controlPanel.setSize(Layout.mainWidth, Layout.controlPanelHeight);
    this.controlPanel.setPosition(Layout.mainLeft, panelTop);
    panelTop += this.controlPanel.height;

    let remaining = this.height - panelTop;
    if (this.pianoPanel.isVisible()) {
      this.pianoPanel.setSize(Layout.mainWidth, Layout.pianoHeight);
      this.pianoPanel.setPosition(
        Layout.mainLeft,
        this.height - this.pianoPanel.height,
      );
      remaining = remaining - this.pianoPanel.height;
    }

    this.patternPanel.setPosition(Layout.mainLeft, panelTop);
    this.patternPanel.setSize(Layout.mainWidth, remaining);

    this.sidebar.setPosition(0, 0);
    this.sidebar.setSize(Layout.sidebarWidth, this.height);
  }

  getDiskOperations(): DiskOperations {
    return this.appPanel.diskOperations;
  }
}
