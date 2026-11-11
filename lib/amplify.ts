// Amplify config for server code (route handlers, server components, middleware).
// Client components call `Amplify.configure(outputs, { ssr: true })` once, see lib/theme/shell.tsx.
import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import outputs from "../amplify_outputs.json";

export const { runWithAmplifyServerContext } = createServerRunner({ config: outputs });
export { outputs };
