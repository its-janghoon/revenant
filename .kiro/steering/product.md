---
inclusion: always
---

# Product: Revenant

Revenant is an open-source, self-hosted "Lovable on your own AWS account".
You say what you want ("build me a contract signing site"), a Kiro agent writes the spec,
builds the app, and deploys it into **your** AWS account. When a build or deploy dies,
the agent reads the logs, fixes it, and brings it back.

## Whose problem

Companies that want everything on AWS:

1. They pay per seat for Vercel, Lovable and similar tools, and the bill grows with the team.
2. For convenience they hand their infrastructure, code and data to those vendors, and
   that is a burden (security review, data location, lock-in, a second cloud to audit).

Revenant gives them the same build-and-ship experience inside their own AWS account:
no seats, their VPC, their IAM, their bill (and their AWS credits, if they have them).

## What makes it different from Lovable, Bolt, v0

1. **You own everything.** Code in CodeCommit and infra in your AWS account, one
   Amplify Gen 2 app per app. Uninstalling Revenant leaves every app running.
2. **Paid by your AWS credits.** Every screen shows credits left and what each app costs.
3. **Spec first.** Kiro writes requirements, design and tasks before code. You edit the
   spec, not the prompt history.
4. **It fixes itself.** Failed builds and deploys are repaired by the agent, with the
   cause, the fix and the evidence on record.

## Demo story

"Build me a contract signing site where an AI flags toxic clauses before you sign."
Revenant writes the FinePrint spec, builds it, deploys it to AWS, a deploy dies on a
planted break, the agent resurrects it, the site is live. FinePrint ("Blood Oath" in Haunted) is the example app,
not a separate product.

## Theme

One switch: **Light** (default, plain, no effects) or **Haunted** (dark, Halloween words,
effects). Haunted has a **Calm** option that turns the effects off. The theme never follows
the OS setting. Failed deploys "die" (tombstone), repairs are "rituals", live apps have
"risen". The theme never changes behaviour. Avoid purple/orange and ghost icons: that is
what every other entry does. Use horror-film grammar instead: darkness, a flashlight,
grain, a heartbeat that flatlines and comes back.

## Hackathon

- Event: Kiroween 2026 (Devpost). Category: **Frankenstein** (Lovable-style builder +
  Kiro CLI + CloudFormation + a self-healing agent, stitched into one).
- Deadline: 2026-12-04 14:00 PT (2026-12-05 07:00 KST). No extensions.
- Bonus prizes: Best Startup Project (McKinley Rice), Best Kiro Crew App, Best Demo,
  Bonus Blog Prize, Social Blitz.
- All code in this repo is written on or after 2026-10-30. Do not import code from other
  McKinley Rice / Redrob repositories. Libraries and starter templates are fine.
- All submission material is in English.
