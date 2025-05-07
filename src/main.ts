import App from "./app";
import Host from "./host";
import Tracker from "./tracker";
import Settings from "./settings";
import Audio from "./audio";
import Editor from "./editor";
import { UI } from "./ui/main";
import { ModalDialog } from "./ui/components/modalDialog";

export const debug = false;

class Main {
  init() {
    console.log("initialising");
    Host.init();
    Tracker.init();
    Audio.init();

    UI.startMeasure();
    UI.init(function () {
      window.focus();
      const isBrowserSupported = Audio.context && window.requestAnimationFrame;
      if (!isBrowserSupported) {
        console.error("Browser not supported");
        if (UI.mainPanel == null) {
          console.error(
            "Failed to render browser not supported dialog due to the main panel not being initalised!",
          );
          return;
        }
        const dialog = new ModalDialog();
        dialog.setProperties({
          width: UI.mainPanel.width,
          height: UI.mainPanel.height,
          top: 0,
          left: 0,
          ok: true,
        });
        dialog.onDown = function () {
          window.location.href = "https://www.google.com/chrome/";
        };
        dialog.setText(
          "Sorry//Your browser does not support WebAudio//Supported browsers are/Chrome,Firefox,Safari and Edge",
        );

        UI.setModalElement(dialog);
      } else {
        Settings.readSettings();
        if (debug) UI.measure("Read & Apply Settings");
        App.init();
        Host.signalReady();
        Editor.loadInitialFile();
        if (debug) UI.endMeasure();
      }
    });
  }
}

export default new Main();
