import Settings from "./settings";
import type HostBridge from "./hosts/hostbridge";

/*
 Bridges Host functions BassoonTracker is running in.
 Currently supports
 	Web
 	WebPlugin
 	FriendUp
*/

declare const HostBridge: HostBridge;

class Host {
  hostBridge: HostBridge | null = null;

  useUrlParams = true;
  useDropbox = true;
  showInternalMenu = true;
  useWebWorkers = true;
  useInitialLoad = true;

  init() {
    if (typeof HostBridge === "object") {
      this.hostBridge = HostBridge;
      this.hostBridge.init();

      if (typeof this.hostBridge.useUrlParams === "boolean")
        this.useUrlParams = this.hostBridge.useUrlParams;
      if (typeof this.hostBridge.useDropbox === "boolean")
        this.useDropbox = this.hostBridge.useDropbox;
      if (typeof this.hostBridge.showInternalMenu === "boolean")
        this.showInternalMenu = this.hostBridge.showInternalMenu;
      if (typeof this.hostBridge.useWebWorkers === "boolean")
        this.useWebWorkers = this.hostBridge.useWebWorkers;
    }
  }

  getBaseUrl(): string {
    if (this.hostBridge && this.hostBridge.getBaseUrl) {
      return this.hostBridge.getBaseUrl();
    }

    // Settings.baseUrl ... hmm ... can't remember where that is coming from
    if (typeof Settings === "undefined") {
      return "";
    } else {
      return Settings.baseUrl || "";
    }
  }

  getRemoteUrl(): string {
    if (this.hostBridge && this.hostBridge.getRemoteUrl) {
      return this.hostBridge.getRemoteUrl();
    }
    return "";
  }

  getVersionNumber(): string {
    const versionNumber = import.meta.env.PACKAGE_VERSION;
    if (typeof versionNumber !== "undefined") return versionNumber;
    if (this.hostBridge && this.hostBridge.getVersionNumber)
      return this.hostBridge.getVersionNumber();
    return "dev";
  }

  getBuildNumber(): number {
    const buildNumber = Number(import.meta.env.BUILD_VERSION);
    if (typeof buildNumber !== "undefined") return buildNumber;
    if (this.hostBridge && this.hostBridge.getBuildNumber)
      return this.hostBridge.getBuildNumber();
    return new Date().getTime();
  }

  signalReady() {
    if (this.hostBridge && this.hostBridge.signalReady)
      this.hostBridge.signalReady();
  }

  // putFile(filename,file){

  // };
}

export default new Host();
