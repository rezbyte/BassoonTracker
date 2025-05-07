import { COMMAND, EVENT } from "../../../enum";
import Label from "../../components/label";
import Panel from "../../components/panel";
import Scale9Panel from "../../components/scale9";
import { Y } from "../../yascal/yascal";
import Assets from "../../assets";
import App from "../../../app";
import ListBox, { ListBoxItem } from "../../components/listbox";
import EventBus from "../../../eventBus";
import Host from "../../../host";
import FetchService from "../../../fetchService";
import Tracker from "../../../tracker";
import Button from "../../components/button";
import Layout from "../layout";
import { UI } from "../../main";

export default class AppSidebar extends Panel {
  private playlist: ListBoxItem[];
  private sideLabel: Label;
  private toggleButton: Button;
  private toggleUIButton: Button;
  private skipButton: Button;
  private background: Scale9Panel;
  private playlistControlPanel: Scale9Panel;
  private playListIndex: number;
  private playlistActive: boolean;
  private listbox: ListBox;

  constructor() {
    // UI.app_sidebar
    super(0, 0, 200, 200);
    this.setProperties({
      name: "sideBar",
    });

    this.background = new Scale9Panel(0, 0, this.width, this.height, {
      img: Y.getImage("background"),
      left: 3,
      top: 3,
      right: 4,
      bottom: 4,
    });
    this.background.ignoreEvents = true;
    this.addChild(this.background);

    this.sideLabel = new Label();
    this.sideLabel.setProperties({
      label: "Playlist:",
      font: UI.fontFT,
    });
    this.addChild(this.sideLabel);

    this.toggleButton = Assets.generate("buttonKey");
    this.addChild(this.toggleButton);

    this.toggleButton.onClick = function () {
      App.doCommand(COMMAND.toggleAppSideBar);
    };

    this.skipButton = Assets.generate("buttonKey");
    this.skipButton.setLabel("Next");
    this.skipButton.onClick = () => {
      this.next();
    };

    this.toggleUIButton = Assets.generate("buttonKey");
    this.toggleUIButton.setLabel("Toggle UI");
    this.toggleUIButton.onClick = function () {};

    this.playlistControlPanel = new Scale9Panel(0, 0, this.width, this.height, {
      img: Y.getImage("background"),
      left: 3,
      top: 3,
      right: 4,
      bottom: 4,
    });
    this.playlistControlPanel.ignoreEvents = true;
    this.addChild(this.playlistControlPanel);

    this.addChild(this.skipButton);
    this.addChild(this.toggleUIButton);

    this.listbox = new ListBox(2, 50, 100, 100);
    this.listbox.setProperties({
      font: UI.fontFT,
    });
    this.addChild(this.listbox);

    this.playlist = [
      { label: "Demomusic", url: "/demomods/demomusic.mod", index: 0 },
      {
        label: "Stardust Memories",
        url: "/demomods/StardustMemories.mod",
        index: 1,
      },
      { label: "Space Debry", url: "/demomods/spacedeb.mod", index: 2 },
    ];

    this.playListIndex = 0;
    this.playlistActive = false;

    this.listbox.onChange = function () {
      //console.error(v);
    };
    this.listbox.onClick = () => {
      const eventX = this.listbox.eventX;
      if (eventX === undefined) {
        console.error("AppSidebar listbox expected eventX to be processed!");
        return;
      }
      const eventY = this.listbox.eventY;
      if (eventY === undefined) {
        console.error("AppSidebar listbox expected eventY to be processed!");
        return;
      }

      const item = this.listbox.getItemAtPosition(eventX, eventY);
      if (item && item.url) {
        this.playListPlaySong(item.index);
      }
    };
    EventBus.on(EVENT.songEnd, () => {
      this.next();
    });

    this.onResize = this._onResize.bind(this);
    this.onResize();

    const playlistPath = Host.getBaseUrl() + "/demomods/Playlist/";
    FetchService.get(playlistPath + "list.txt", (list) => {
      if (list === undefined) {
        console.error(`Failed to get playlist at ${playlistPath}list.txt`);
        return;
      }
      const splitList = list.split("\n");
      splitList.forEach((item, index) => {
        if (item)
          this.playlist.push({ label: item, url: playlistPath + item, index });
      });

      this.playListIndex = 0;
      this.playlistActive = false;
      this.listbox.setItems(this.playlist);
    });
  }

  _onResize() {
    this.background.setSize(this.width, this.height);
    this.toggleButton.setPosition(this.width - 22, 2);

    this.sideLabel.setSize(this.width, Layout.trackControlHeight);
    this.playlistControlPanel.setPosition(2, 32);
    this.playlistControlPanel.setSize(this.width - 4, 54);

    this.skipButton.setPosition(8, 36);
    this.skipButton.setProperties({
      width: this.width < 50 ? 20 : 100,
    });
    this.skipButton.setLabel(this.width < 50 ? ">" : "Next");

    this.toggleUIButton.setPosition(8, 56);
    this.toggleUIButton.setProperties({
      width: this.width < 50 ? 20 : 100,
    });
    this.toggleUIButton.setLabel(this.width < 50 ? "-" : "Toggle UI");

    const listboxTop = 32 + 54 + 2;
    this.listbox.setProperties({
      left: 2,
      top: listboxTop,
      width: this.width - 4,
      height: this.height - listboxTop - Layout.defaultMargin,
    });

    if (this.width < 50) {
      this.sideLabel.hide();
      this.playlistControlPanel.hide();
      this.listbox.hide();

      this.skipButton.setPosition(2, 36);
    } else {
      this.sideLabel.show();
      this.playlistControlPanel.show();
      this.listbox.show();
    }
  }

  private playListPlaySong(index: number) {
    const item = this.playlist[index];
    if (item) {
      this.listbox.setSelectedIndex(index);
      this.playListIndex = index;
      this.playlistActive = true;
      Tracker.autoPlay = true;
      Tracker.load(item.url);
    }
  }

  private next() {
    if (this.playlistActive) {
      this.playListIndex++;
      if (this.playListIndex >= this.playlist.length) {
        this.playListIndex = 0;
      }
      Tracker.stop();
      this.playListPlaySong(this.playListIndex);
    }
  }
}
