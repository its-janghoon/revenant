// Entry for the repair rules (lib/repair/construct.ts). The Deployer port is
// lib/deploy/repair-port.ts; nothing here may import "server-only" or next/*.
import { makeHandler } from "../../../lib/repair/handler";
import { deployer } from "../../../lib/deploy/repair-port";

export const handler = makeHandler(deployer);
