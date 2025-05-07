import Panel from "../../components/panel";
import Scale9Panel from "../../components/scale9";
import Assets from "../../assets";
import ListBox from "../../components/listbox";
import Button from "../../components/button";
import Tracker from "../../../tracker";
import ticker from "../../ticker";
import Editor from "../../../editor";
import EventBus from "../../../eventBus";
import { EVENT } from "../../../enum";
import Song from "../../../models/song";

export default class AppSongPatternList extends Panel {
  private songPanel: Scale9Panel;
  private songlistbox: ListBox;
  private spPlus: Button;
  private spMin: Button;
  private spInsert: Button;
  private spDelete: Button;
  constructor() {
    // UI.app_songPatternList
    super();
    this.songPanel = new Scale9Panel(0, 0, 0, 0, Assets.panelInsetScale9);
    this.addChild(this.songPanel);

    this.songlistbox = new ListBox();
    this.songlistbox.setItems([{ label: "01:00", data: 1, index: 0 }]);
    this.songlistbox.onClick = (touch) => {
      const item = this.songlistbox.getItemAtPosition(touch.x, touch.y);
      if (item) {
        const index = item.index;
        if (index !== this.songlistbox.getSelectedIndex()) {
          this.songlistbox.setSelectedIndex(index);
        }
      }
    };
    this.addChild(this.songlistbox);

    this.spPlus = Assets.generate("button20_20");
    this.spPlus.setLabel("↑");
    this.spPlus.onDown = () => {
      const song = Tracker.getSong();
      if (song == null) return;
      const index = this.songlistbox.getSelectedIndex();
      let pattern = song.patternTable[index];
      pattern++;
      Tracker.updatePatternTable(index, pattern);
      ticker.onEachTick4(() => {
        const index = this.songlistbox.getSelectedIndex();
        let pattern = song.patternTable[index];
        pattern++;
        Tracker.updatePatternTable(index, pattern);
      }, 5);
    };
    this.spPlus.onTouchUp = () => {
      ticker.onEachTick4();
    };
    this.addChild(this.spPlus);

    this.spMin = Assets.generate("button20_20");
    this.spMin.setLabel("↓");
    this.spMin.onDown = () => {
      const song = Tracker.getSong();
      if (song == null) return;
      const index = this.songlistbox.getSelectedIndex();
      let pattern = song.patternTable[index];
      if (pattern > 0) pattern--;
      Tracker.updatePatternTable(index, pattern);
      ticker.onEachTick4(() => {
        const index = this.songlistbox.getSelectedIndex();
        let pattern = song.patternTable[index];
        if (pattern > 0) pattern--;
        Tracker.updatePatternTable(index, pattern);
      }, 5);
    };
    this.spMin.onTouchUp = () => {
      ticker.onEachTick4();
    };
    this.addChild(this.spMin);

    this.spInsert = Assets.generate("button20_20");
    this.spInsert.setLabel("Ins");
    this.spInsert.onDown = () => {
      const index = this.songlistbox.getSelectedIndex();
      Editor.addToPatternTable(index);
    };
    this.spInsert.setProperties({ width: 40, height: 20 });
    this.addChild(this.spInsert);

    this.spDelete = Assets.generate("button20_20");
    this.spDelete.setLabel("Del");
    this.spDelete.onDown = () => {
      const index = this.songlistbox.getSelectedIndex();
      Editor.removeFromPatternTable(index);
    };
    this.spDelete.setProperties({ width: 40, height: 20 });
    this.addChild(this.spDelete);
    EventBus.on(EVENT.patternTableChange, () => {
      const song = Tracker.getSong();
      if (song == null) {
        console.error(
          "AppSongPatternList recieved a patternTableChange event without a song loaded!",
        );
        return;
      }
      this.setPatternTable(song);
    });
    EventBus.on(EVENT.songLoaded, (song: Song) => {
      this.setPatternTable(song);
    });
    EventBus.on(EVENT.songPositionChange, (value: number) => {
      this.songlistbox.setSelectedIndex(value, true);
    });
  }

  onResize() {
    this.songPanel.setSize(this.width, this.height);

    this.songlistbox.setProperties({
      left: 0,
      top: 0,
      width: this.width - 42,
      height: this.height,
      centerSelection: true,
      onChange: () => {
        Tracker.setCurrentSongPosition(
          this.songlistbox.getSelectedIndex(),
          true,
        );
      },
    });

    this.spMin.setPosition(this.width - 22, Math.floor(this.height / 2) - 10);
    this.spPlus.setPosition(this.width - 42, this.spMin.top);

    this.spInsert.setPosition(this.spPlus.left, this.spPlus.top - 22);
    this.spDelete.setPosition(this.spPlus.left, this.spPlus.top + 22);
  }

  setPatternTable(song: Song) {
    const patternTable = song.patternTable;
    const items = [];
    for (let i = 0, len = song.length; i < len; i++) {
      const value = patternTable[i];
      items.push({
        label: this.padd2(i + 1) + ":" + this.padd2(value),
        data: value,
        index: i,
      });
    }
    this.songlistbox.setItems(items);
  }

  private padd2(s: number): string {
    let ret = "" + s;
    if (ret.length < 2) {
      ret = "0" + ret;
    }
    return ret;
  }
}
