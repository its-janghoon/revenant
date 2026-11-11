---
inclusion: always
---

# Product: Revenant

Revenant is an open-source, self-hosted "Lovable on your own AWS account".
You say what you want ("build me a contract signing site"), a Kiro agent writes the spec,
builds the app, and deploys it into **your** AWS account. When a build or deploy dies,
the agent reads the logs, fixes it, and brings it back.

## Whose problem

Startups that have AWS credits (AWS Activate, often $1k to $100k) but still pay Lovable,
Vercel and a database vendor every month, because building and shipping on AWS is hard.
Revenant lets them build the same way and spend the credits they already have.

Secondary: agencies and freelancers who build sites for clients and must hand over
code and hosting the client owns.

## What makes it different from Lovable, Bolt, v0

1. **You own everything.** Code in your GitHub, infra in your AWS account, one
   CloudFormation stack per app. Uninstalling Revenant leaves every app running.
2. **Paid by your AWS credits.** Every screen shows credits left and what each app costs.
3. **Spec first.** Kiro writes requirements, design and tasks before code. You edit the
   spec, not the prompt history.
4. **It fixes itself.** Failed builds and deploys are repaired by the agent, with the
   cause, the fix and the evidence on record.

## Demo story

"Build me a contract signing site where an AI flags toxic clauses before you sign."
Revenant writes the BloodOath spec, builds it, deploys it to AWS, a deploy dies on a
planted break, the agent resurrects it, the site is live. BloodOath is the example app,
not a separate product.

## Theme

Halloween is a **toggle**, like dark/light. Normal mode is a clean light/dark UI that
follows the system setting. Halloween mode changes looks and words only: failed deploys
"die" (tombstone), repairs are "rituals", live apps have "risen". It never changes behaviour.

## Hackathon

- Event: Kiroween 2026 (Devpost). Category: **Frankenstein** (Lovable-style builder +
  Kiro CLI + CloudFormation + a self-healing agent, stitched into one).
- Deadline: 2026-12-04 14:00 PT (2026-12-05 07:00 KST). No extensions.
- Bonus prizes: Best Startup Project (McKinley Rice), Best Kiro Crew App, Best Demo,
  Bonus Blog Prize, Social Blitz.
- All code in this repo is written on or after 2026-10-30. Do not import code from other
  McKinley Rice / Redrob repositories. Libraries and starter templates are fine.
- All submission material is in English.
