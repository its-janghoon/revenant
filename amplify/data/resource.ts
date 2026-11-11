import { a, defineData, type ClientSchema } from "@aws-amplify/backend";
import { TIMELINE_KINDS } from "../../lib/contracts";
import { timeline } from "../functions/timeline/resource";

// Timeline: append-only, realtime. Written only by the timeline function (runner log
// subscription and server events); signed-in users read and subscribe.
// Per-project access is checked by the app before it subscribes (projects live in SQL).
const schema = a
  .schema({
    Event: a
      .model({
        projectId: a.id().required(),
        at: a.datetime().required(),
        kind: a.enum([...TIMELINE_KINDS]),
        text: a.string().required(),
      })
      .identifier(["projectId", "at"])
      .disableOperations(["update", "delete"])
      .authorization((allow) => [allow.authenticated().to(["read", "listen"])]),
  })
  .authorization((allow) => [allow.resource(timeline).to(["mutate", "query"])]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: "userPool" },
});
