import Editor from "../editor";
import Tracker from "../tracker";
import { MODULETYPE } from "../enum";
import FetchService from "../fetchService";
import Logger from "../log";
import { BinaryStream } from "../filesystem";
import { UI } from "../ui/main";

class BassoonProvider {
  private readonly baseUrl = "https://www.stef.be/bassoontracker/api/";
  private processing = false;

  putFile() {
    const url = this.baseUrl + "storage/put/";

    Editor.buildBinary(
      Tracker.inFTMode() ? MODULETYPE.xm : MODULETYPE.mod,
      function (file) {
        //const b = new Blob([file.buffer], {type: "application/octet-stream"});

        const fileName = Tracker.getFileName();

        FetchService.sendBinary(url, file.buffer, function (result) {
          console.error(result);
        });
      },
    );
  }

  renderFile(fileName: string, toMp3: boolean): void {
    if (this.processing) {
      console.error("already processing ...");
      return;
    }

    this.processing = true;
    const url =
      this.baseUrl + "storage/render/" + (Tracker.inFTMode() ? "xm" : "mod");
    fileName = fileName || Tracker.getFileName();
    UI.setStatus("saving file ...", true);
    Logger.info("Rendering " + fileName);

    const baseUrl = this.baseUrl;
    const handleError = (consoleMessage: string, uiMessage?: string) =>
      this.handleError(consoleMessage, uiMessage);
    const downloadFile = (url: string, filename: string, extention: string) =>
      this.downloadFile(url, filename, extention);
    Editor.buildBinary(
      Tracker.inFTMode() ? MODULETYPE.xm : MODULETYPE.mod,
      function (file: BinaryStream) {
        //const b = new Blob([file.buffer], {type: "application/octet-stream"});

        FetchService.sendBinary(url, file.buffer, function (result) {
          if (result === "error") {
            handleError("error saving file");
          } else {
            const tempFile = result;
            console.log(tempFile + ": converting file ...");
            UI.setStatus("rendering file ...", true);
            const url = baseUrl + "storage/convert/" + tempFile;
            FetchService.sendBinary(url, file.buffer, function (result) {
              if (result === "error" || result == undefined) {
                handleError(
                  "error converting file",
                  "Error rendering file ...",
                );
              } else {
                const tempFile = result;
                if (toMp3) {
                  console.log(tempFile + ": converting to mp3");
                  UI.setStatus("Converting file to mp3...", true);
                  const url = baseUrl + "storage/wavtomp3/" + tempFile;
                  FetchService.sendBinary(url, file.buffer, function (result) {
                    console.error(result);
                    if (result === "error" || result == undefined) {
                      handleError(
                        "error converting file to mp3",
                        "Error converting file to mp3...",
                      );
                    } else {
                      downloadFile(result, fileName, "mp3");
                    }
                  });
                } else {
                  downloadFile(tempFile, fileName, "wav");
                }
              }
            });
          }
        });
      },
    );
  }

  proxyUrl(url: string): string {
    return this.baseUrl + "proxy?" + encodeURIComponent(url);
  }

  private handleError(consoleMessage: string, uiMessage?: string): void {
    console.error(consoleMessage);
    UI.setStatus(uiMessage ?? consoleMessage);
    this.processing = false;
  }

  private downloadFile(url: string, filename: string, extention: string): void {
    if (extention) {
      let hasExtention = false;
      const p = filename.lastIndexOf(".");
      if (p >= 0)
        hasExtention =
          filename.substr(p + 1).toLowerCase() === extention.toLowerCase();
      if (!hasExtention) filename += "." + extention;
    }
    console.log("Downloading " + url + " as " + filename);
    UI.setStatus("Downloading ...");
    this.processing = false;
    setTimeout(function () {
      UI.setStatus("");
    }, 3000);
    document.location.href =
      this.baseUrl + "storage/" + url + "?dl=1&name=" + filename;
  }
}

export default new BassoonProvider();
