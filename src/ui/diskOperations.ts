import Panel from "./components/panel";
import Scale9Panel from "./components/scale9";
import Assets from "./assets";
import Label from "./components/label";
import ListBox, { ListBoxItem } from "./components/listbox";
import Button, { ButtonProperties } from "./components/button";
import { UI } from "./main";
import { COMMAND, EVENT, FILETYPE, VIEW } from "../enum";
import EventBus from "../eventBus";
import Layout from "./app/layout";
import FetchService from "../fetchService";
import Host from "../host";
import Dropbox from "../provider/dropbox";
import Tracker from "../tracker";
import App from "../app";
import { Y } from "./yascal/yascal";
import { RadioGroupItem } from "./components/radiogroup";
import DiskOperationActions from "./diskOp_Actions";
import DiskOperationType from "./diskOp_Type";
import DiskOperationTargets from "./diskOp_Targets";
import DiskOperationSave from "./diskOp_Save";
import ModulesPl from "../provider/modulespl";
import ModArchive from "../provider/modarchive";
import { TextAlignment } from "./basetypes";

interface Samples {
  samples: ListBoxItem[];
}

export default class DiskOperations extends Panel {
  private currentAction: string;
  private currentView: string; // TODO: Enum for views
  private currentsSubView: VIEW | null;
  private itemsMap: ListBoxItem[];
  private modules: ListBoxItem[];
  private samples: ListBoxItem[];
  private modArchive: ListBoxItem[];
  private modulesPl: ListBoxItem[];
  private dropBoxList: ListBoxItem[];
  private sampleSelectedIndex: number;
  private moduleSelectedIndex: number;
  private onLoadChildren:
    | ((item: ListBoxItem, data: ListBoxItem[] | Samples | undefined) => void)
    | null;
  private itemHandler:
    | typeof ModulesPl
    | typeof ModArchive
    | typeof Dropbox
    | null = null;
  private background: Scale9Panel;
  private actionPanel: DiskOperationActions;
  private typePanel: DiskOperationType;
  private targetPanel: DiskOperationTargets;
  private savePanel: DiskOperationSave;
  private buttonProperties: ButtonProperties;
  private saveButton: Button;
  private loadButton: Button;
  private label: Label;
  private closeButton: Button;
  private browseButton: Button;
  private input: HTMLInputElement | null;
  private listbox: ListBox;
  private dropzone: Button;
  constructor() {
    // UI.DiskOperations
    super();
    this.hide();

    this.currentAction = "load";
    this.currentView = "modules";
    this.currentsSubView = null;
    this.itemsMap = [];

    this.modules = [];
    this.samples = [];
    this.modArchive = [];
    this.modulesPl = [];
    this.dropBoxList = [];
    this.sampleSelectedIndex = 0;
    this.moduleSelectedIndex = 0;
    this.onLoadChildren = null;
    this.itemHandler;

    this.background = new Scale9Panel(0, 0, 20, 20, Assets.panelMainScale9);
    this.background.ignoreEvents = true;
    this.addChild(this.background);

    this.actionPanel = new DiskOperationActions();
    this.addChild(this.actionPanel);

    this.typePanel = new DiskOperationType();
    this.addChild(this.typePanel);

    this.targetPanel = new DiskOperationTargets();
    this.addChild(this.targetPanel);

    this.savePanel = new DiskOperationSave();
    this.addChild(this.savePanel);

    // buttons for small screen UI
    this.buttonProperties = {
      background: Assets.buttonKeyScale9,
      activeBackground: Assets.buttonKeyActiveScale9,
      isActive: false,
      textAlign: TextAlignment.center,
      font: UI.fontDark,
      paddingTopActive: 1,
      height: 18,
      width: 50,
    };

    this.saveButton = new Button();
    this.loadButton = new Button();
    this.loadButton.setActive(true);

    this.saveButton.setProperties(this.buttonProperties);
    this.saveButton.setLabel("Save");
    this.saveButton.onDown = () => {
      this.actionPanel.setSelectedIndex(1);
    };
    this.addChild(this.saveButton);

    this.loadButton.setProperties(this.buttonProperties);
    this.loadButton.setLabel("Load");
    this.loadButton.onDown = () => {
      this.actionPanel.setSelectedIndex(0);
    };
    this.addChild(this.loadButton);

    this.label = new Label({
      label: "Load module",
      font: UI.fontMed,
    });
    this.addChild(this.label);

    this.closeButton = Assets.generate("button20_20");
    this.closeButton.setLabel("x");
    this.closeButton.onClick = () => {
      App.doCommand(COMMAND.showTopMain);
    };
    this.addChild(this.closeButton);

    this.browseButton = Assets.generate("buttonKey");
    this.browseButton.setLabel("browse");
    this.browseButton.onClick = () => {
      this.input = document.createElement("input");
      this.input.type = "file";
      this.input.onchange = () => {
        const files = this.input?.files; // e.target.files
        if (files == null) return;
        Tracker.handleUpload(files);
      };
      this.input.click();
    };
    this.addChild(this.browseButton);
    this.browseButton.hide();

    this.input = null;

    this.listbox = new ListBox();
    this.addChild(this.listbox);

    this.dropzone = new Button();
    this.dropzone.setProperties({
      background: Assets.buttonDarkActiveScale9,
      image: Y.getImage("dropzone"),
      font: UI.fontSmall,
      textAlign: TextAlignment.center,
    });
    this.dropzone.onClick = this.browseButton.onClick;
    this.addChild(this.dropzone);
    this.dropzone.hide();

    EventBus.on(
      EVENT.diskOperationTargetChange,
      (target: RadioGroupItem | undefined) => {
        const action = this.actionPanel.getAction();

        let targetString = "";
        if (target && target.target) targetString = target.target;
        if (
          target &&
          target.fileType !== undefined &&
          target.fileType !== null
        ) {
          if (target.fileType === FILETYPE.module) targetString = "modules";
          if (target.fileType === FILETYPE.sample) targetString = "samples";
        }
        if (typeof target === "undefined")
          targetString = this.targetPanel.getTarget();

        console.log(targetString);

        if (action === "save") {
          this.currentAction = "save";
          this.currentView = this.typePanel.getType();

          const labelText =
            this.currentView === "samples" ? "Export Sample" : "Export Module";
          this.label.setLabel(labelText);

          if (this.loadButton.isActive) this.loadButton.setActive(false);
          if (!this.saveButton.isActive) this.saveButton.setActive(true);
          this.dropzone.hide();
          this.browseButton.hide();

          this.onResize();

          if (targetString === "dropbox") {
            Dropbox.checkConnected((isConnected) => {
              if (!isConnected) {
                Dropbox.showConnectDialog();
              }
            });
          }
        } else {
          this.currentAction = "load";
          this.refreshList(targetString);

          if (!this.loadButton.isActive) this.loadButton.setActive(true);
          if (this.saveButton.isActive) this.saveButton.setActive(false);
        }
      },
    );

    EventBus.on(EVENT.instrumentChange, () => {
      if (this.isVisible() && this.currentView == "samples")
        this.label.setLabel(
          "Load Sample to slot " + Tracker.getCurrentInstrumentIndex(),
        );
    });
  }

  onShow() {
    this.onResize();
  }

  onResize() {
    if (this.isVisible()) {
      this.clearCanvas();

      this.background.setProperties({
        left: 0,
        top: 0,
        height: this.height,
        width: this.width,
      });

      const startTop = 5;

      this.closeButton.setProperties({
        top: startTop - 2,
        width: 20,
        height: 18,
        left: this.width - 30,
      });

      this.browseButton.setProperties({
        top: this.closeButton.top + 2,
        width: 55,
        height: 18,
        left: this.closeButton.left - 60,
      });

      if (this.width >= 730) {
        this.actionPanel.show();
        this.label.show();
        this.loadButton.hide();
        this.saveButton.hide();

        this.actionPanel.setProperties({
          top: startTop,
          left: Layout.col1X,
          width: Layout.col1W,
          height: this.height - 10,
        });
        this.typePanel.setProperties({
          top: startTop,
          left: Layout.col2X,
          width: Layout.col1W,
          height: this.height - 10,
        });
        this.targetPanel.setProperties({
          top: startTop,
          left: Layout.col3X,
          width: Layout.col1W,
          height: this.height - 10,
        });

        this.label.setProperties({
          left: Layout.col4X,
          top: startTop,
          height: 20,
          width: Layout.col2W,
        });

        this.listbox.setProperties({
          left: Layout.col4X,
          width: Layout.col2W,
          top: startTop + 19,
          height: this.height - (19 + startTop) - 5,
        });
      } else {
        this.actionPanel.hide();
        this.label.hide();
        this.loadButton.show();
        this.saveButton.show();

        this.loadButton.setProperties({
          top: 5,
          left: Layout.col3X,
        });
        this.saveButton.setProperties({
          top: 5,
          left: Layout.col3X + 50,
        });

        this.typePanel.setProperties({
          top: startTop,
          left: Layout.defaultMargin,
          width: Layout.col2W,
          height: this.height / 2 - startTop - 16,
        });

        this.targetPanel.setProperties({
          top: this.height / 2 - 16,
          left: Layout.defaultMargin,
          width: Layout.col2W,
          height: this.height / 2 + 16,
        });

        this.listbox.setProperties({
          left: Layout.col3X,
          width: Layout.col3W,
          top: startTop + 19,
          height: this.height - (19 + startTop) - 5,
        });
      }

      if (this.currentAction === "save") {
        this.savePanel.setProperties({
          left: this.listbox.left,
          width: this.listbox.width,
          top: this.listbox.top,
          height: this.listbox.height,
        });

        this.listbox.hide();
        this.savePanel.show();
      } else {
        this.listbox.show();
        this.savePanel.hide();
      }

      this.dropzone.setProperties({
        left: this.listbox.left,
        width: this.listbox.width,
        top: this.listbox.top,
        height: this.listbox.height,
      });
    }
  }

  setView(subView: VIEW) {
    this.currentsSubView = subView;
    this.refreshList(
      this.currentsSubView === VIEW.sampleEditor ? "samples" : "",
    );

    switch (subView) {
      case VIEW.fileOperationsSaveFile:
        this.actionPanel.setSelectedIndex(1);
        break;
      case VIEW.fileOperationsSaveModule:
        this.actionPanel.setSelectedIndex(1);
        this.typePanel.setType(0);
        break;
      case VIEW.fileOperationsSaveSample:
        this.actionPanel.setSelectedIndex(1);
        this.typePanel.setType(1);
        break;
      case VIEW.fileOperationsLoadModule:
        this.actionPanel.setSelectedIndex(0);
        this.typePanel.setType(0);
        break;
      case VIEW.fileOperationsLoadSample:
        this.actionPanel.setSelectedIndex(0);
        this.typePanel.setType(1);
        break;
    }
  }

  refreshList(type?: string) {
    if (this.currentAction === "save") return;

    const items: ListBoxItem[] = [];
    let index = 0;

    if (this.currentView !== type) this.listbox.setSelectedIndex(0, true);
    this.currentView = type || this.currentView;

    const addListatLevel = (data: ListBoxItem[], level: number) => {
      data.forEach((item) => {
        let icon;
        if (item.icon && typeof item.icon === "string")
          icon = Y.getImage(item.icon);
        if (!icon)
          icon =
            this.currentView === "modules"
              ? Y.getImage("module")
              : Y.getImage("sample");
        if (item.children) icon = Y.getImage("disk");
        items.push({
          label: item.title ?? item.label,
          data: 1,
          level: level,
          index: index,
          icon: icon,
          info: item.info,
        }); // data: item,
        this.itemsMap[index] = item;
        index++;

        if (item.children && item.children.length && item.isExpanded) {
          addListatLevel(item.children, level + 1);
        }
      });
    };

    const populate = (data: ListBoxItem[], selectedIndex: number) => {
      this.itemsMap = [];
      index = 0;
      selectedIndex = selectedIndex || 0;
      addListatLevel(data, 0);
      this.listbox.setItems(items);
      this.listbox.setSelectedIndex(selectedIndex);
    };

    if (this.currentView == "local") {
      this.listbox.hide();
      this.dropzone.show();
      this.browseButton.show();
    } else {
      this.listbox.show();
      this.dropzone.hide();
      this.browseButton.hide();

      if (this.currentView == "bassoon") {
        this.currentView = this.typePanel.getType();
      }
    }

    switch (this.currentView) {
      case "modules":
        this.itemHandler = null;
        this.label.setLabel("Load Module");
        this.listbox.onClick = (e) => {
          let item = this.listbox.getItemAtPosition(e.x, e.y);
          if (item && item.data) {
            const index = item.index;
            item = this.itemsMap[index];

            if (item.children) {
              this.toggleDirectory(item, index);
            } else {
              this.listbox.setSelectedIndex(index);
              Tracker.load(item.url);
              App.doCommand(COMMAND.showTopMain);
            }
          }
        };

        if (this.modules.length) {
          populate(this.modules, this.moduleSelectedIndex);
        } else {
          FetchService.json(
            Host.getBaseUrl() + "data/modules.json",
            (data?: { modules: ListBoxItem[] }) => {
              if (data && data.modules) {
                this.modules = data.modules;
                populate(this.modules, this.moduleSelectedIndex);
              }
            },
          );
        }
        break;
      case "modarchive":
        this.itemHandler = ModArchive;
        this.label.setLabel("Browse Modarchive");
        this.listbox.onClick = (e) => {
          let item = this.listbox.getItemAtPosition(e.x, e.y);
          if (item && item.data) {
            const index = item.index;
            item = this.itemsMap[index];

            if (item.children) {
              this.toggleDirectory(item, index);
            } else {
              this.listbox.setSelectedIndex(index);
              Tracker.load(item.url);
              App.doCommand(COMMAND.showTopMain);
            }
          }
        };
        this.onLoadChildren = (item, data) => {
          if (data !== undefined && !DiskOperations.isSamples(data)) {
            if (item.title == "... load more ..." && item.parent) {
              const parent = item.parent;
              data.forEach((child) => {
                child.parent = parent;
              });
              const siblings = parent.children!;
              siblings.pop();
              parent.children = siblings.concat(data);
            } else {
              data.forEach((child) => {
                child.parent = item;
              });
              item.children = data;
            }
          } else {
            item.children = [
              {
                title: "error loading data",
                label: "error loading data",
                index: 0,
              },
            ];
            console.error(
              "this does not seem to be a valid modArchive API response",
            );
          }
          this.refreshList();
        };

        if (this.modArchive.length) {
          populate(this.modArchive, 0);
        } else {
          this.listbox.setItems([{ label: "loading ...", index: 0 }]);

          FetchService.json<{ modarchive: ListBoxItem[] }>(
            Host.getBaseUrl() + "data/modarchive.json",
            (data) => {
              if (data && data.modarchive) {
                this.modArchive = data.modarchive;
                populate(this.modArchive, 0);
              }
            },
          );
        }
        break;

      case "modulespl":
        this.itemHandler = ModulesPl;
        this.label.setLabel("Browse Modules.pl");
        this.listbox.onClick = (e) => {
          let item = this.listbox.getItemAtPosition(e.x, e.y);
          if (item && item.data) {
            const index = item.index;
            item = this.itemsMap[index];

            if (item.children) {
              this.toggleDirectory(item, index);
            } else {
              this.listbox.setSelectedIndex(index);
              Tracker.load(item.url);
              App.doCommand(COMMAND.showTopMain);
            }
          }
        };
        this.onLoadChildren = (item, data) => {
          if (data !== undefined && !DiskOperations.isSamples(data)) {
            if (item.title == "... load more ..." && item.parent) {
              const parent = item.parent;
              data.forEach((child) => {
                child.parent = parent;
              });
              const siblings = parent.children!;
              siblings.pop();
              parent.children = siblings.concat(data);
            } else {
              data.forEach((child) => {
                child.parent = item;
              });
              item.children = data;
            }
          } else {
            item.children = [
              {
                title: "error loading data",
                label: "error loading data",
                index: 0,
              },
            ];
            console.error(
              "this does not seem to be a valid modArchive API response",
            );
          }
          this.refreshList();
        };

        if (this.modulesPl.length) {
          populate(this.modulesPl, 0);
        } else {
          this.listbox.setItems([{ label: "loading ...", index: 0 }]);

          FetchService.json(
            Host.getBaseUrl() + "data/modulespl.json",
            (data?: { modulespl: ListBoxItem[] }) => {
              if (data && data.modulespl) {
                this.modulesPl = data.modulespl;
                populate(this.modulesPl, 0);
              }
            },
          );
        }
        break;

      case "dropbox":
        this.itemHandler = Dropbox;
        this.label.setLabel("Browse Your Dropbox");

        UI.setStatus("Contacting Dropbox", true);
        this.listbox.setItems([{ label: "loading ...", index: 0 }]);

        this.listbox.onClick = (e) => {
          let item = this.listbox.getItemAtPosition(e.x, e.y);
          if (item && item.data) {
            const index = item.index;
            item = this.itemsMap[index];

            if (item.children) {
              this.toggleDirectory(item, index);
            } else {
              this.listbox.setSelectedIndex(index);
              const fileName = item.title ?? item.label;
              if (item.url === undefined) {
                console.error(
                  `No URL available for item: ${fileName} to load children from!`,
                );
                return;
              }

              UI.setInfo(fileName);
              UI.setStatus("Loading from Dropbox", true);

              Dropbox.getFile(item.url, (blob) => {
                const reader = new FileReader();
                reader.onload = () => {
                  Tracker.processFile(
                    reader.result as ArrayBuffer,
                    fileName,
                    () => {
                      UI.setStatus("Ready");
                    },
                  );
                };
                reader.readAsArrayBuffer(blob);
              });
            }
          }
        };

        this.onLoadChildren = (item, data) => {
          if (data !== undefined && !DiskOperations.isSamples(data)) {
            data.forEach((child) => {
              child.parent = item;
            });
            item.children = data;
          } else {
            item.children = [
              {
                title: "error loading data",
                label: "error loading data",
                index: 0,
              },
            ];
            console.error(
              "this does not seem to be a valid dropbox API response",
            );
          }
          this.refreshList();
        };

        if (this.dropBoxList.length) {
          populate(this.dropBoxList, 0);
        } else {
          Dropbox.checkConnected((isConnected) => {
            if (isConnected) {
              Dropbox.list("", (data) => {
                UI.setStatus("");
                this.dropBoxList = data;
                populate(data, 0);
              });
            } else {
              console.log("Dropbox not connected");
              Dropbox.showConnectDialog();
            }
          });
        }

        break;
      case "samples":
        this.itemHandler = null;
        this.label.setLabel(
          "Load Sample to slot " + Tracker.getCurrentInstrumentIndex(),
        );
        this.listbox.onClick = (e) => {
          let item = this.listbox.getItemAtPosition(e.x, e.y);
          if (item && item.data) {
            const index = item.index;
            item = this.itemsMap[index];

            if (item.children) {
              this.listbox.setSelectedIndex(index);
              this.sampleSelectedIndex = index;
              if (item.isExpanded) {
                item.isExpanded = false;
                this.refreshList();
              } else {
                item.isExpanded = true;
                if (item.children.length) {
                  this.refreshList();
                } else {
                  if (item.url === undefined) {
                    console.error(`No URL available for sample: ${item.label}`);
                    return;
                  }
                  FetchService.json<Samples>(item.url, (data) => {
                    if (item && data && data.samples) {
                      item.children = data.samples;
                      this.refreshList();
                    }
                  });
                }
              }
            } else {
              this.listbox.setSelectedIndex(index);
              Tracker.load(item.url);
              //UI.mainPanel.setView("resetTop");
            }
          }
        };
        this.onLoadChildren = (
          item: ListBoxItem,
          data: ListBoxItem[] | Samples | undefined,
        ) => {
          if (DiskOperations.isSamples(data)) {
            item.children = data.samples;
            this.refreshList();
          }
        };

        if (this.samples.length) {
          populate(this.samples, this.sampleSelectedIndex);
        } else {
          FetchService.json(
            Host.getBaseUrl() + "data/samples.json",
            (data?: Samples) => {
              if (data && data.samples) {
                this.samples = data.samples;
                populate(this.samples, this.sampleSelectedIndex);
              }
            },
          );
        }
        break;
      case "local":
        this.itemHandler = null;
        this.label.setLabel("Upload files");
        break;
    }
  }

  playRandomSong(format?: string) {
    //Todo: Add API rate check?
    //Or move this to the local database?

    const useModArchiveAPI = true;

    if (useModArchiveAPI) {
      UI.setStatus("Fetching random song", true);
      UI.setInfo("");
      FetchService.json(
        "https://www.stef.be/bassoontracker/api/random" + (format || ""),
        (data?: { modarchive: { module: ListBoxItem } }) => {
          if (data && data.modarchive && data.modarchive.module) {
            Tracker.load(data.modarchive.module.url);
          } else {
            console.error(
              "this does not seem to be a valid modArchive API response",
            );
          }
        },
      );
    } else {
      const message = document.createElement("div");
      message.className = "message";
      message.innerHTML =
        "Due to a sudden spike of traffic, the ModArchive API has reached its limit and is currently unavailable.<br>We are working on a solution.";
      document.body.appendChild(message);

      setTimeout(() => {
        document.body.removeChild(message);
      }, 4000);
    }
  }

  private toggleDirectory(item: ListBoxItem, index: number) {
    this.listbox.setSelectedIndex(index);
    this.moduleSelectedIndex = index;
    if (item.isExpanded) {
      item.isExpanded = false;
      this.refreshList();
    } else {
      item.isExpanded = true;
      if (item.children?.length) {
        this.refreshList();
      } else {
        if (item.url === undefined) {
          console.error(
            `No URL available for directory: ${item.label} to load children from!`,
          );
          return;
        }
        console.log("load children from " + item.url);
        item.children = [{ title: "loading ...", label: "", index: 0 }];

        this.refreshList();

        if (this.itemHandler) {
          this.itemHandler.get(item.url, (data) => {
            this.onLoadChildren?.(item, data);
          });
        } else {
          FetchService.json<ListBoxItem[]>(item.url, (data) => {
            this.onLoadChildren?.(item, data);
          });
        }
      }
    }
  }
  private static isSamples(
    data: ListBoxItem[] | Samples | undefined,
  ): data is Samples {
    return data !== undefined && (data as Samples).samples !== undefined;
  }
}
