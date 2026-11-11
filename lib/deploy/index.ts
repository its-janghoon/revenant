// Deploy flow (Requirement 5). Entry points for other lanes:
//   nextPreview(project)                  before a run: the BRANCH to give the runner
//   deployPreview(project, branch, commit) after the run pushed: start the preview deploy
//   settle(project, deploy) / settleAll    follow open deploys to live or failed (+ health check)
//   plan / publish / approve               publish a live preview to production
//   getDomain / setDomain                  custom domain records
//   checkCommit(project, branch, commit)  Code tab: synth + guard in the runner, then the preview deploy
//   setHooks({ sql, application, computeRole, failed })  what this lane needs from L3, L6, L4;
//                                         ./wire registers the real ones on import
import "./wire";
export { PROD, branchUrl, ensureApp, ensureBranch, envOf, previewBranch, previewNumber } from "./amplify";
export { checkCommit, checkRunId, followCheck } from "./check";
export { getDomain, setDomain } from "./domain";
export { health } from "./health";
export { setHooks, type DeployHooks, type SqlHooks } from "./hooks";
export { deployPreview, nextPreview, previewsOf } from "./preview";
export { advance, approve, openPublish, plan, publish, snapshotId } from "./publish";
export { settle, settleAll } from "./settle";
export type { DnsRecord, DomainState, PreviewInfo, PublishDetail } from "./types";
