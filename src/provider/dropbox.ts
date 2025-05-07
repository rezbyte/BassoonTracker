import { ModalDialog } from "../ui/components/modalDialog";
import { UI } from "../ui/main";
import EventBus from "../eventBus";
import { EVENT } from "../enum";
import Settings, { type dropBoxModeSetting } from "../settings";
import dropboxService from "../lib/dropbox";
import type { ListBoxItem } from "../ui/components/listbox";

class Dropbox {

  private authRedirect = "https://www.stef.be/bassoontracker/auth/dropbox.html";
  private isConnected = false;

  checkConnected(next: (isConnected: boolean) => void) {
    if (this.isConnected) {
      if (next) next(true);
    }

    if (dropboxService.getAccessToken()) {
      dropboxService.call("users/get_current_account", undefined, undefined, {
        onComplete: (result) => {
          if (result && result.account_id) {
            this.isConnected = true;
            if (next) next(true);
          }
        },
        onError: () => {
          if (next) next(false);
        },
      });
    } else {
      if (next) next(false);
    }
  };

  showConnectDialog() {
    if (UI.mainPanel === null) {
      console.error("Cannot display DropBox connect dialog without the main panel being initialised!");
      return;
    }
    const dialog = new ModalDialog();
    dialog.setProperties({
      width: UI.mainPanel.width,
      height: UI.mainPanel.height,
      top: 0,
      left: 0,
      ok: true,
      cancel: true,
    });

    dialog.onClick = (touchData) => {
      const elm = dialog.getElementAtPoint(touchData.x, touchData.y);
      if (elm && elm.name) {
        UI.setStatus("");
        if (elm.name === "okbutton") {
          this.authenticate();
        } else {
          dialog.close();
          EventBus.trigger(EVENT.dropboxConnectCancel);
        }
      }
    };

    dialog.setText(
      "DROPBOX ://BassoonTracker is not yet connected to DropBox//Do you want to do that now?//(BassoonTracker will only have access/to its own BassoonTracker folder)"
    );

    UI.setModalElement(dialog);
  };

  authenticate() {
    dropboxService.clearAccessToken();
    dropboxService.authenticate(
      { client_id: "ukk9z4f0nd1xa13", redirect_uri: this.authRedirect },
      {
        onComplete: function () {
          console.log("ok!");
         // console.log(a);
        },
        onError: function (a) {
          console.error("not OK!");
          console.log(a);
        },
      }
    );
  };

  list(path: string, next: (items: ListBoxItem[]) => void) {
    dropboxService.call("files/list_folder", { path: path }, undefined, function (data) {
      const result: ListBoxItem[] = [];

      data.entries.forEach(function (item, i) {
        if (item[".tag"] && item[".tag"] === "folder") {
          result.push({ title: item.name, label: item.name, url: item.path_lower, children: [], index: i });
        } else {
          const size = Math.floor(item.size / 1000) + "kb";
          const title = item.name + " (" + size + ")" || "---";
          result.push({
            title: title,
            label: title,
            url: item.id,
            //path: item.path_display,
            index: i
          });
        }
      });

      next(result);
    });
  };

  get(url: string, next: (items: ListBoxItem[]) => void) {
    this.list(url, next);
  };

  getFile(url: string, next: (a: Blob) => void) {
    dropboxService.call(
      "files/download",
      { path: url },
      undefined,
      function (result, a, b) {
        console.log(result);
        console.log(a); // content
        console.log(b);
        next(a);
      }
    );
  };

  putFile(path: string, content: Blob, next?: (success: boolean) => void) {
    const options: {path: string, mode?: dropBoxModeSetting, autorename?: true} = { path: path };
    if (Settings.dropboxMode === "overwrite") {
      options.mode = "overwrite";
    } else {
      options.mode = "add";
      options.autorename = true;
    }

    dropboxService.call("files/upload", options, content, {
      onComplete: function (result, a, b) {
        console.log(result);
        console.log(a);
        console.log(b);
        if (next) next(result != null);
      },
      onError: function (a) { // onError: function (result, a, b) {
        if (next) next(false);
      },
    });
  };

};

export default new Dropbox();
