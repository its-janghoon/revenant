// Entry for the repair rules (lib/repair/construct.ts).
// The deployer port comes from lane L2 (lib/deploy). Until L2 is merged this file
// fails to compile on purpose, so the wiring cannot be forgotten at integration.
import { makeHandler } from "../../../lib/repair/handler";
import { deployer } from "../../../lib/deploy/repair-port";

export const handler = makeHandler(deployer);
