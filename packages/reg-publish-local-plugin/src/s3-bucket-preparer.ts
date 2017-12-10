import * as mkdirp from "mkdirp";
import * as path from "path";
import * as uuid from "uuid/v4";
import { PluginPreparer,
  PluginCreateOptions,
  PreparerQuestions,
  PluginLogger
} from "reg-suit-interface";
import { PluginConfig } from "./s3-publisher-plugin";

export interface SetupInquireResult {
  createBucket: boolean;
  bucketName?: string;
}

const BUCKET_PREFIX = "reg-publish-local";

export class S3BucketPreparer implements PluginPreparer<SetupInquireResult, PluginConfig> {
  _logger: PluginLogger;

  inquire() {
    return [
      {
        name: "createBucket",
        type: "confirm",
        message: "Create a new S3 bucket",
        default: true,
      },
      {
        name: "bucketName",
        type: "input",
        message: "Existing bucket name",
        when: (ctx: { createBucket: boolean }) => !ctx.createBucket,
      },
    ];
  }

  prepare(config: PluginCreateOptions<SetupInquireResult>) {
    this._logger = config.logger;
    const id = uuid();
    const bucketName = path.join(config.options.bucketName as string, `${BUCKET_PREFIX}-${id}`);
    if (config.noEmit) {
      this._logger.info(`Skip to create directory ${bucketName} because noEmit option.`);
      return Promise.resolve({ bucketName });
    }
    this._logger.info(`Create new directory: ${this._logger.colors.magenta(bucketName)}`);
    const spinner = this._logger.getSpinner(`creating bucket...`);
    spinner.start();
    return this._createDirectory(bucketName)
      .then(bucketName => {
        spinner.stop();
        return { bucketName };
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
