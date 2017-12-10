import { PublisherPluginFactory } from "reg-suit-interface";
import { LocalPublisherPlugin } from "./local-publisher-plugin";
import { LocalBucketPreparer } from "./local-bucket-preparer";

const pluginFactory: PublisherPluginFactory = () => {
  return {
    preparer: new LocalBucketPreparer(),
    publisher: new LocalPublisherPlugin(),
  };
};

export = pluginFactory;
