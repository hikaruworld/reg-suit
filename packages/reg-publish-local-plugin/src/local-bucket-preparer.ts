import * as mkdirp from "mkdirp";
import * as path from "path";
import * as uuid from "uuid/v4";
import { PluginPreparer,
  PluginCreateOptions,
  PreparerQuestions,
  PluginLogger
} from "reg-suit-interface";
import { PluginConfig } from "./local-publisher-plugin";

export interface SetupInquireResult {
  createBucket: boolean;
  directoryPath?: string;
}

const BUCKET_PREFIX = "reg-publish-local";

export class LocalBucketPreparer implements PluginPreparer<SetupInquireResult, PluginConfig> {
  _logger: PluginLogger;

  inquire() {
    return [
      {
        name: "createBucket",
        type: "confirm",
        message: "Create a new Directory",
        default: true,
      },
      {
        name: "directoryPath",
        type: "input",
        message: "Existing bucket name",
        when: (ctx: { createBucket: boolean }) => !ctx.createBucket,
      },
    ];
  }

  prepare(config: PluginCreateOptions<SetupInquireResult>) {
    this._logger = config.logger;
    const id = uuid();
    const directoryPath = path.join(config.options.directoryPath as string, `${BUCKET_PREFIX}-${id}`);
    if (config.noEmit) {
      this._logger.info(`Skip to create directory ${directoryPath} because noEmit option.`);
      return Promise.resolve({ directoryPath });
    }
    this._logger.info(`Create new directory: ${this._logger.colors.magenta(directoryPath)}`);
    const spinner = this._logger.getSpinner(`creating bucket...`);
    spinner.start();
    return this._createDirectory(directoryPath)
      .then(directoryPath => {
        spinner.stop();
        return { directoryPath };
      })
    ;
  }

  _createDirectory(directory: string) {
    return new Promise<string>((resolve, reject) => {
      mkdirp(directory, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve(directory);
      })
    });
  }

}
