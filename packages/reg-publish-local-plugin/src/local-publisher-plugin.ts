import * as fs from "fs-extra";
import * as path from "path";
import * as zlib from "zlib";
import * as glob from "glob";
import * as _ from "lodash";
import * as mkdirp from "mkdirp";
import { lookup } from "mime-types";
import { PublisherPlugin,
  PluginCreateOptions,
  PluginLogger
} from "reg-suit-interface";

export interface PluginConfig {
  directoryPath: string;
  pattern?: string;
}

interface PluginConfigInternal extends PluginConfig {
  pattern: string;
}

export interface FileItem {
  path: string;
  absPath: string;
  mimeType: string;
}

const DEFAULT_PATTERN = "**/*.{html,js,wasm,png,json,jpeg,jpg,tiff,bmp,gif}";
const CONCURRENCY_SIZE = 50;

export class LocalPublisherPlugin implements PublisherPlugin<PluginConfig> {

  name = "reg-publish-local-plugin";

  _noEmit: boolean;
  private _logger: PluginLogger;
  private _options: PluginCreateOptions<any>;
  private _pluginConfig: PluginConfigInternal;

  constructor() {
  }

  init(config: PluginCreateOptions<PluginConfig>) {
    this._options = config;
    this._pluginConfig = {
      pattern: DEFAULT_PATTERN,
      ...config.options,
    };
    this._noEmit = config.noEmit;
    this._logger = config.logger;
  }

  createList(): Promise<FileItem[]> {
    return new Promise<string[]>((resolve, reject) => {
      glob(this._pluginConfig.pattern, {
        cwd: this._options.workingDirs.base,
      }, (err, list) => {
        if (err) {
          return reject(err);
        }
        resolve(list);
      });
    })
    .then(files => {
      return files.map(f => {
        const mimeType = lookup(f) || "unknown";
        return {
          path: f,
          absPath: path.resolve(this._options.workingDirs.base, f),
          mimeType,
        };
      })
      .filter(item => !!item.mimeType)
      ;
    })
    ;
  }

  publish(key: string) {
    return this._publishInternal(key).then(result => {
      return { reportUrl: result.reportUrl };
    });
  }

  fetch(key: string): Promise<any> {
    if (this._noEmit) return Promise.resolve();
    const actualPrefix = `${key}/${path.basename(this._options.workingDirs.actualDir)}`;
    const actualPath = path.join(this._pluginConfig.directoryPath, actualPrefix);
    fs.mkdirsSync(actualPath);
    const progress = this._logger.getProgressBar();
    return new Promise<string[]>((resolve, reject) => {
      fs.readdir(actualPath, (err, files) => {
        if (err) {
            return reject(err);
        }
        resolve(files);
      });
    })
    .then((files) => {
      if (files.length) {
        progress.start(files.length, 0);
      }
      return files.map(file => {
        const suffix = file.replace(new RegExp(`^${actualPath}\/`), "");
        return {
          path: suffix,
          absPath: path.join(this._options.workingDirs.expectedDir, suffix),
          mimeType: lookup(suffix),
        } as FileItem;
      });
    })
    .then((files) => {
      return Promise.all(files.map((file) => {
        fs.copySync(`${actualPath}/${path.basename(file.path)}`, file.absPath);
        progress.increment(1);
      }));
    })
    ;
  }

  _publishInternal(key: string) {
    const progress = this._logger.getProgressBar();
    return this.createList()
      .then(list => {
        if (list.length) {
          progress.start(list.length, 0);
          if (!this._noEmit) {
            this._logger.info(`Upload ${list.length} files to ${this._logger.colors.magenta(this._pluginConfig.directoryPath)}.`);
          } else {
            this._logger.info(`There are ${list.length} files to publish`);
          }
        }
        return _.chunk(list, CONCURRENCY_SIZE);
      })
      .then(chunks => {
        return chunks.reduce((acc, chunk) => {
          return acc.then(list => {
            return Promise.all(chunk.map(item => {
              if (this._noEmit) return Promise.resolve(item);
              return this._publishItem(key, item).then(fi => {
                progress.increment(1);
                return fi;
              });
            })).then(items => [...list, ...items]);
          });
        }, Promise.resolve([] as FileItem[]));
      })
      .then(items => {
        const indexFile = items.find(item => item.path.endsWith("index.html"));
        const reportUrl = indexFile && path.join(this._pluginConfig.directoryPath, key, indexFile.path);
        return { reportUrl, items };
      })
      .then(result => {
        progress.stop();
        return result;
      })
      ;
  }

  _publishItem(key: string, item: FileItem): Promise<FileItem> {
    const actualPrefix = `${key}/${path.basename(this._options.workingDirs.actualDir)}`;
    const actualPath = path.join(this._pluginConfig.directoryPath, actualPrefix);
    fs.mkdirsSync(actualPath);
    return new Promise((resolve, reject) => {
      fs.readFile(item.absPath, (err, content) => {
        if (err) return reject(err);
        fs.copySync(item.absPath, `${actualPath}/${path.basename(item.path)}`);
        return resolve(item)
      });
    });
  }

}
