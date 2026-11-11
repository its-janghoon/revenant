# Revenant runner image for CodeBuild ARM (arm64). Build from the repository root:
#   docker build --platform linux/arm64 -f runner/Dockerfile -t revenant-runner .
FROM public.ecr.aws/docker/library/node:24-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates curl unzip python3 python3-pip \
 && rm -rf /var/lib/apt/lists/*

# AWS CLI v2 (also the CodeCommit credential helper)
RUN curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/aws.zip \
 && unzip -q /tmp/aws.zip -d /tmp \
 && /tmp/aws/install \
 && rm -rf /tmp/aws /tmp/aws.zip

RUN pip3 install --no-cache-dir --break-system-packages cfn-lint \
 && npm install -g tsx@4

# Kiro CLI (headless with KIRO_API_KEY)
RUN curl -fsSL https://cli.kiro.dev/install | bash
ENV PATH="/root/.local/bin:${PATH}"
RUN kiro-cli --version

WORKDIR /opt/revenant
COPY runner/ runner/
COPY steering/ steering/
COPY blocks/ blocks/
COPY templates/ templates/
COPY lib/ lib/
RUN mkdir -p /work

CMD ["node", "/opt/revenant/runner/run.ts"]
