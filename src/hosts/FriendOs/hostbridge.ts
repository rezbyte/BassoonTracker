import HostBridge, { Message } from "../hostbridge";
import Tracker from "../../tracker";
import { commandFromString } from "../../enum";
import App from "../../app";
import { UI } from "../../ui/main";
import FetchService from "../../fetchService";
import Editor from "../../editor";

declare class Application {
  static progDir: any;
  static initFriendVR: boolean;
  static receiveMessage: (msg: Message) => void;
  static friendCallBackId: string;
  static sessionId: string;
  static sendMessage: (msg: Partial<Message>) => void;
  static bsn_versionNumber: string;
  static bsn_buildNumber: number;
}

class FriendOSBridge implements HostBridge {
  friendCallBackId: string = "";

  // FriendOS maps local urls to filesystem reads, urls paramater won't work
  useUrlParams = false;

  //FriendOS has its own Dropbox integration
  useDropbox = false;

  //FriendOS has its own Menu system
  showInternalMenu = false;

  //there some weird with "importscripts" in workers with the Friend paths ... still have to figure it out
  useWebWorkers = false;

  getBaseUrl() {
    // use a function - progDir is not available yet at load time
    return Application.progDir;
  }

  getRemoteUrl() {
    return "https://www.stef.be/bassoontracker/";
  }

  init() {
    const isFriendUp =
      typeof Application === "object" && Application.initFriendVR;
    if (isFriendUp) console.log("running on FriendUP");
    if (!isFriendUp) return;
    Application.receiveMessage =  (msg) => {
      if (msg.type === "bassoontracker") {
        console.log("got message", msg);

        // bloody annoying, right, that Friend keeps stealing focus?
        window.focus();
        switch (msg.command) {
          case "setMessageHandler":
            this.friendCallBackId = msg.callbackId;
            break;
          case "loadFile":
            if (typeof msg.files !== "object") {
              console.error("Malformed loadFile message from FriendOS!");
              break;
            }
            const file = msg.files[0];
            if (file  && file.Path) {
              const url =
                "/system.library/file/read?sessionid=" +
                Application.sessionId +
                "&path=" +
                file.Path +
                "&mode=rs";
              Tracker.load(url, false, function () {});
            }
            break;
          case "getFileName":{
            const filename = Tracker.getFileName();
            if (msg.callbackId) {
              console.warn("setting callback");
              this.sendMessage({
                callbackId: msg.callbackId,
                command: "message",
                message: filename,
              });
            }
            break;
          }
          case "saveFile":
            if (typeof msg.files !== "string") {
              console.error("Malformed saveFile message from FriendOS!");
              break;
            }
            const filename = msg.files.split("/").pop();
            Editor.save(filename, function (blob) {
              UI.setStatus("Saving File to FriendOS", true);
              console.log("Saving File to FriendOS", msg.files);
              const url =
                "/system.library/file/upload/?sessionid=" +
                Application.sessionId +
                "&path=" +
                msg.files;

              const formData = new FormData();
              formData.append("file", blob, "");
              FetchService.sendBinary(url, formData, function (data) {
                UI.setStatus("");
                console.log("result from upload: " + data);
              });
            });
            break;
          default:
            const command = commandFromString(msg.command);
            if (command !== null) {
              App.doCommand(command);
            } else {
              console.warn("Unhandled message: " + msg);
            }
        }
      }
    };
  }

  sendMessage(msg: Partial<Message> | string) {
    if (this.friendCallBackId) {
      const finalMsg: Partial<Message> = typeof msg === "string" ? { command: "message", message: msg } : msg || {}
      finalMsg.type = "callback";
      finalMsg.callback = this.friendCallBackId;
      Application.sendMessage(finalMsg);
    } else {
      console.warn("can't send message, friendCallBackId not setup");
    }
  }

  getVersionNumber() {
    return Application.bsn_versionNumber;
  }

  getBuildNumber() {
    return Application.bsn_buildNumber;
  }
}

export default new FriendOSBridge();
