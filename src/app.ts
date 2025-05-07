import { COMMAND, EVENT, VIEW } from "./enum";
import Host from "./host";
import EventBus from "./eventBus";
import Tracker from "./tracker";
import Editor from "./editor";
import Midi from "./audio/midi";
import { ModalDialog } from "./ui/components/modalDialog";
import { UI } from "./ui/main";
import Settings from "./settings";

declare class Stats {
  // from src/plugins/stats.js
  dom: Node;
  update(): void;
}

class app {
  readonly buildNumber: string =
    typeof import.meta.env.PACKAGE_VERSION === "undefined"
      ? ""
      : import.meta.env.PACKAGE_VERSION;
  isPlugin: boolean = false;

  init() {
    if (
      typeof Midi === "object" &&
      Settings &&
      Settings.midi &&
      Settings.midi !== "disabled"
    )
      Midi.init();

    EventBus.on(EVENT.command, (command: COMMAND) => {
      window.focus();

      switch (command) {
        case COMMAND.newFile:
          Tracker.new();
          break;
        case COMMAND.openFile:
          EventBus.trigger(EVENT.showView, VIEW.fileOperationsOpenFile);
          break;
        case COMMAND.saveFile:
          EventBus.trigger(EVENT.showView, VIEW.fileOperationsSaveFile);
          break;
        case COMMAND.clearTrack:
          Editor.clearTrack();
          break;
        case COMMAND.clearPattern:
          Editor.clearPattern();
          break;
        case COMMAND.clearInstruments:
          Tracker.clearInstruments();
          break;
        case COMMAND.clearSong:
          Editor.clearSong();
          break;
        case COMMAND.showMain:
          EventBus.trigger(EVENT.showView, VIEW.main);
          break;
        case COMMAND.showTopMain:
          EventBus.trigger(EVENT.showView, VIEW.topMain);
          break;
        case COMMAND.showBottomMain:
          EventBus.trigger(EVENT.showView, VIEW.bottomMain);
          break;
        case COMMAND.showOptions:
          EventBus.trigger(EVENT.showView, VIEW.options);
          break;
        case COMMAND.showFileOperations:
          EventBus.trigger(EVENT.showView, VIEW.fileOperations);
          break;
        case COMMAND.showSampleEditor:
          EventBus.trigger(EVENT.showView, VIEW.sampleEditor);
          break;
        case COMMAND.togglePiano:
          EventBus.trigger(EVENT.toggleView, VIEW.piano);
          break;
        case COMMAND.toggleAppSideBar:
          EventBus.trigger(EVENT.toggleView, VIEW.appSideBar);
          break;
        case COMMAND.showAbout:
          if (UI.mainPanel == null) {
            console.error(
              "Could not show the About modal because the main panel has not been initalized!",
            );
            break;
          }
          const dialog = new ModalDialog();
          dialog.setProperties({
            width: UI.mainPanel.width,
            height: UI.mainPanel.height,
            top: 0,
            left: 0,
            ok: true,
          });
          dialog.onClick = dialog.close;

          const version = Host.getVersionNumber();
          const build = Host.getBuildNumber();
          dialog.setText(
            "BassoonTracker//Old School Amiga MOD and XM tracker/in plain javascript//©2017-2021 by Steffest//version " +
              version +
              "//Fork me on Github!",
          );

          UI.setModalElement(dialog);
          break;
        case COMMAND.showHelp:
          window.open("https://www.stef.be/bassoontracker/docs/");
          break;
        case COMMAND.randomSong:
          UI.playRandomSong();
          break;
        case COMMAND.randomSongXM:
          UI.playRandomSong("xm");
          break;
        case COMMAND.showGithub:
          window.open("https://github.com/steffest/bassoontracker");
          break;
        case COMMAND.showStats:
          const stats = document.getElementById("MrDStats");
          if (!stats) {
            const script = document.createElement("script");
            script.onload = function () {
              const stats = new Stats();
              document.body.appendChild(stats.dom);
              requestAnimationFrame(function loop() {
                stats.update();
                requestAnimationFrame(loop);
              });
            };
            script.src = "src/plugins/stats.js";
            document.head.appendChild(script);
            break;
          }
          break;
        case COMMAND.cut:
          UI.cutSelection(true);
          break;
        case COMMAND.copy:
          UI.copySelection(true);
          break;
        case COMMAND.paste:
          UI.pasteSelection(true);
          break;
        case COMMAND.pattern2Sample:
          Editor.renderTrackToBuffer();
          break;
        case COMMAND.undo:
          EventBus.trigger(EVENT.commandUndo);
          break;
        case COMMAND.redo:
          EventBus.trigger(EVENT.commandRedo);
          break;
        case COMMAND.nibbles:
          // TODO: Port Nibbles
          /*Plugin.load("Nibbles", function () {
            Nibbles.init({
              UI: UI,
              Input: Input,
              Y: Y,
              EventBus: EventBus,
              EVENT: EVENT,
              COMMAND: COMMAND,
              Layout: Layout,
            });
          });*/
          break;
      }
    });
  }

  doCommand(command: COMMAND) {
    EventBus.trigger(EVENT.command, command);
  }
}

export default new app();
