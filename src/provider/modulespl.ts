
import FetchService from "../fetchService";
import { formatFileSize } from "../lib/util";
import type { ListBoxItem } from "../ui/components/listbox";

interface Artist {
  id: number,
  handle: string,
  count: number,
}

interface Genre {
  name: string,
  count: number
}

interface Module {
  id: number,
	title: string,
  author: number,
  genre: string,
  rate: number,
  score: number,
  format: string,
  size: number
}

class ModulesPl {
  private readonly apiUrl = "https://www.stef.be/bassoontracker/api/mpl/";
  private readonly proxyUrl = "https://www.stef.be/bassoontracker/api/modules.pl/";
  private genres: ListBoxItem[] = [];
  private artists: ListBoxItem[] = [];

  get(url: string, next: (items: ListBoxItem[]) => void) {
    const params = url.split("/");

    url = params[0];
    const param = params[1] || "";
    let page = params[2] || "";

    switch (url) {
      case "genres":
        this.loadGenres(next);
        break;
      case "genre":
        this.loadGenre(param, page, next);
        break;
      case "toprating":
        page = param || "1";
        this.loadFromApi<Module>("toprating/" + page, (data) => {
          next(this.parseModList(data, "rate"));
        });
        break;
      case "topscore":
        page = param || "1";
        this.loadFromApi<Module>("topscore/" + page, (data) => {
          next(this.parseModList(data, "score"));
        });
        break;
      case "artists":
        this.loadArtists(next);
        break;
      case "artist":
        let apiUrl = "artist/" + param;
        if (page) apiUrl += "/" + page;
        this.loadFromApi<Module>(apiUrl, (data) => {
          next(this.parseModList(data));
        });
        break;
      default:
        next([]);
    }
  };

  private loadArtists(next: (items: ListBoxItem[]) => void) {
    if (this.artists.length) {
      if (next) next(this.artists);
    } else {
      this.loadFromApi<Artist>("artists", (result) => {
        if (result) {
          result.forEach((artist, i) => {
            console.log(artist);
            const item = {
              title: artist.handle,
              label: artist.handle,
              info: artist.count + " >",
              url: "artist/" + artist.id,
              children: [],
              index: i
            };
            this.artists.push(item);
          });
        }
        if (next) next(this.artists);
      });
    }
  }

  private loadGenres(next: (items: ListBoxItem[]) => void) {
    if (this.genres.length) {
      if (next) next(this.genres);
    } else {
      this.loadFromApi<Genre>("genres", (result) => {
        if (result) {
          result.forEach((genre, i) => {
           const item = {
              title: genre.name,
              label: genre.name,
              url: "genre/" + genre.name,
              children: [],
              info: genre.count + " >",
              index: i
            };
            this.genres.push(item);
          });
        }
        if (next) next(this.genres);
      });
    }
  }

  private loadGenre(id: string, page: string, next: (items: ListBoxItem[]) => void) {
    let url = "genre/" + id;
    if (page) {
      page = parseInt(page).toString();
      url += "/" + page;
    }
    this.loadFromApi<Module>(url, (data) => {
      next(this.parseModList(data));
    });
  }

  private loadFromApi<T extends Artist | Genre | Module>(url: string, next: (data: T[] | undefined) => void) {
    console.log("load from api " + this.apiUrl + url);
    FetchService.json<T[]>(this.apiUrl + url, (data) => {
      next(data);
    });
  }

  private parseModList(data?: Module[], extraInfo?: "rate" | "score"): ListBoxItem[] {
    const result: ListBoxItem[] = [];
    if (data) {
      data.forEach((mod, i) => {
        const info = formatFileSize(mod.size);
        let title = mod.title || "---";
        if (extraInfo) {
          title = mod[extraInfo] + ": " + title;
        }
        result.push({
          title: title,
          label: title,
          url: this.proxyUrl + mod.id,
          info: info,
          icon: mod.format,
          index: i
        });
      });
    }
    return result;
  }
}

export default new ModulesPl();