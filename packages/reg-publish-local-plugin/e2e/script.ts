/* tslint:disable:no-console */
import * as fs from "fs-extra";
import { createLogger } from "reg-suit-util";
import { S3PublisherPlugin } from "../lib/s3-publisher-plugin";
import { S3BucketPreparer } from "../lib/s3-bucket-preparer";
import * as glob from "glob";
import * as assert from "assert";

const preparer = new S3BucketPreparer();

const plugin = new S3PublisherPlugin();
const logger = createLogger();
logger.setLevel("verbose");
const baseConf = {
  coreConfig: { actualDir: "", workingDir: "" },
  logger,
  noEmit: false,
};

const dirsA = {
  base: __dirname + "/../e2e/report-fixture",
  actualDir: __dirname + "/../e2e/report-fixture/dir_a",
  expectedDir: __dirname + "/../e2e/report-fixture/dir_b",
  diffDir: "",
};

const dirsB = {
  base: __dirname + "/../e2e/report-fixture-expected",
  actualDir: __dirname + "/../e2e/report-fixture-expected/dir_a",
  expectedDir: __dirname + "/../e2e/report-fixture-expected/dir_b",
  diffDir: "",
};

let bn: string;
preparer.prepare({ ...baseConf, options: { createBucket: true, directoryPath: "/tmp/bucket-test" }, workingDirs: dirsA })
.then(({ directoryPath }) => {
  bn = directoryPath || "";
  plugin.init({
    ...baseConf,
    options: {
      directoryPath: bn,
    },
    workingDirs: dirsA,
  });
  return plugin.publish("abcdef12345");
})
.then(() => {
  plugin.init({
    ...baseConf,
    options: {
      directoryPath: bn,
    },
    workingDirs: dirsB,
  });
  return plugin.fetch("abcdef12345");
})
.then(() => {
  const list = glob.sync("dir_b/sample01.png", { cwd: dirsB.base });
  assert.equal(list[0], "dir_b/sample01.png");
})
.then(() => {
  fs.removeSync(bn);
  console.log(" 🌟  Test was ended successfully! 🌟 ");
  process.exit(0);
})
.catch(err => {
  console.error(err);
  process.exit(1);
})
;

