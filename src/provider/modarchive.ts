import FetchService from "../fetchService";
import { formatFileSize } from "../lib/util";
import type { ListBoxItem } from "../ui/components/listbox";

interface Artist {
  id: number;
  count: number;
  handle: string;
}

interface Genre {
  id: number;
  count: number;
  name: string;
  parent: number;
}

interface Module {
  artist: string;
  author: number;
  format: string;
  genre: number;
  id: number;
  meta: {
    created: number;
    revision: number;
    version: number;
  };
  rate: number;
  score: number;
  size: number;
  title: string;
}

interface ModArchiveModule {
  filename: string;
  format: string;
  url: string;
  date: string; // In format "Wed 1st Jan 1997"
  timestamp: number;
  id: number;
  hash: string; // MD5 hash
  featured: { state: unknown; date: string; timestamp: number };
  favourites: { favoured: number; myfav: number };
  size: string; // In format 120.37KB
  bytes: number;
  hits: number;
  infopage: string;
  songtitle: string;
  hidetext: number;
  comment: string;
  instruments: string; // A string containing all instrument names concatenated into a single line
  genreid: number;
  genretext: string;
  channels: number;
  overall_ratings: {
    comment_rating: number;
    comment_total: number;
    review_rating: number;
    review_total: number;
  };
  license: {
    licenseid: string;
    title: string;
    description: string;
    imageurl: string;
    deedurl: string;
    legalurl: string;
  };
  artist_info: {
    artists: number;
    artist: {
      id: number;
      alias: string;
      profile: string; // In form "member.php?69140"
      imageurl: string;
      imageurl_thumb: string;
      imageurl_icon: string;
      module_data: { module_description: string };
    };
    guessed_artists: number;
    guessed_artist: { alias: string }[];
  };
}

interface RatingList {
  module: ModArchiveModule[];
  totalpages: string;
  results: string;
}

interface GenreListBoxItem extends ListBoxItem {
  count: number;
}

class ModArchive {
  private readonly apiUrl = "https://www.stef.be/bassoontracker/api/ma/";
  private readonly apiUrlV1 = "https://www.stef.be/bassoontracker/api/";
  private readonly genres: ListBoxItem[] = [];
  private readonly artists: ListBoxItem[] = [];

  get(url: string, next: (items: ListBoxItem[] | undefined) => void) {
    const params = url.split("/");

    url = params[0];
    const param = params[1] || "";
    let page = params[2] || "";

    switch (url) {
      case "genres":
        this.loadGenres(next);
        break;
      case "artists":
        this.loadArtists(next);
        break;
      case "genre":
        this.loadFromApi<Module>("genre/" + param, (data) => {
          next(this.parseModList(data));
        });
        break;
      case "toprating":
        page = param || "1";
        this.loadFromApiV1<RatingList>("toprating/" + page, (data) => {
          next(this.parseModListV1(data, params));
        });
        break;
      case "topreview":
        page = param || "1";
        this.loadFromApiV1<RatingList>("topreview/" + page, (data) => {
          next(this.parseModListV1(data, params));
        });
        break;
      case "artist": {
        let apiUrl = "artist/" + param;
        if (page) apiUrl += "/" + page;
        this.loadFromApi<Module>(apiUrl, (data) => {
          next(this.parseModList(data)); //next(this.parseModList(data, params));
        });
        break;
      }
      default:
        next([]);
    }
  }

  private loadGenres(next: (items: ListBoxItem[]) => void) {
    if (this.genres.length) {
      if (next) next(this.genres);
    } else {
      this.loadFromApi<Genre>("genres", (result) => {
        if (result) {
          const children: GenreListBoxItem[][] = [];
          result.forEach((genre, i) => {
            console.log(genre);
            if (genre.parent) {
              const item = {
                title: genre.name,
                label: genre.name,
                count: genre.count,
                info: genre.count + " >",
                children: [],
                url: "genre/" + genre.id,
                index: i,
              } as GenreListBoxItem;
              if (!children[genre.parent]) children[genre.parent] = [];
              children[genre.parent].push(item);
            }
          });

          result.forEach((genre, i) => {
            if (!genre.parent) {
              const genreChildren = children[genre.id] || [];
              let total = 0;
              genreChildren.forEach((child) => {
                total += child.count;
              });
              const item: ListBoxItem = {
                title: genre.name,
                label: genre.name,
                children: genreChildren,
                info: total + " >",
                index: result.length - 1 + i,
              };
              this.genres.push(item);
            }
          });
        }

        if (next) next(this.genres);
      });
    }
  }

  private loadArtists(next: (items: ListBoxItem[]) => void) {
    if (this.artists.length) {
      if (next) next(this.artists);
    } else {
      this.loadFromApi<Artist>("artists", (result) => {
        if (result) {
          result.forEach((artist, i) => {
            const item: ListBoxItem = {
              title: artist.handle,
              label: artist.handle,
              children: [],
              info: artist.count + " >",
              url: "artist/" + artist.id,
              index: i,
            };
            this.artists.push(item);
          });
        }
        if (next) next(this.artists);
      });
    }
  }

  private loadFromApi<T extends Artist | Genre | Module>(
    url: string,
    next: (data: T[] | undefined) => void,
  ) {
    console.log("load from api " + this.apiUrl + url);
    FetchService.json<T[]>(this.apiUrl + url, (data) => {
      next(data);
    });
  }

  private loadFromApiV1<T extends Artist | Genre | Module | RatingList>(
    url: string,
    next: (data: T | undefined) => void,
  ) {
    console.log("load from api " + this.apiUrl + url);
    FetchService.json<T extends RatingList ? { modarchive: RatingList } : T>(
      this.apiUrlV1 + url,
      (data) => {
        const modArchive: RatingList | undefined = (
          data as { modarchive: RatingList }
        )?.modarchive;
        const finalData = data && modArchive ? modArchive : data;
        next(finalData as T | undefined);
      },
    );
  }

  private parseModList(data?: Module[]): ListBoxItem[] {
    const result: ListBoxItem[] = [];
    if (data) {
      data.forEach((mod, i) => {
        const title = mod.title || "---";
        result.push({
          title: title,
          label: title,
          url: "https://api.modarchive.org/downloads.php?moduleid=" + mod.id,
          icon: mod.format,
          info: formatFileSize(mod.size),
          index: i,
        });
      });
    }
    return result;
  }

  private parseModListV1(
    data:
      | {
          module: ModArchiveModule[] | ModArchiveModule;
          totalpages: string;
          results: string;
        }
      | undefined,
    base: string[],
  ): ListBoxItem[] {
    const result: ListBoxItem[] = [];
    if (data) {
      if (data.module) {
        const mods = data.module;
        if (Array.isArray(mods)) {
          mods.forEach((mod, i) => {
            const title = mod.songtitle || "---";
            result.push({
              title: title,
              label: title,
              url: mod.url,
              icon: "mod",
              index: i,
            });
          });
        } else {
          // single result
          const title = mods.songtitle || "---";
          result.push({
            title: title,
            label: title,
            url: mods.url,
            icon: "mod",
            index: 0,
          });
        }
      }

      if (data.totalpages) {
        const pageCount = parseInt(data.totalpages);
        if (pageCount > 1) {
          let profile = base[0] + "/";
          let currentPage = base[1] ? parseInt(base[1]) : 1;
          if (isNaN(currentPage)) currentPage = 1;

          if (profile == "artist/" || profile == "genre/") {
            profile += base[1] + "/";
            currentPage = base[2] ? parseInt(base[2]) : 1;
            if (isNaN(currentPage)) currentPage = 1;
          }
          if (pageCount > currentPage) {
            profile += currentPage + 1;
            const title = "... load more ...";
            result.push({
              title: title,
              label: title,
              children: [],
              url: profile,
              index: result.length - 1,
            });
          }
        }
      }
    }
    return result;
  }
}

export default new ModArchive();
