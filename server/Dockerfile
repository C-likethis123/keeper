FROM node:24-bookworm-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends git python3 python3-pip \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server/api/package.json server/api/package-lock.json ./
RUN npm ci

COPY server/api ./
RUN npm run build
COPY scripts/moc_pipeline /opt/keeper/moc_pipeline
RUN pip3 install --break-system-packages --no-cache-dir \
	-r /opt/keeper/moc_pipeline/requirements.txt

ENV MOC_PIPELINE_PATH=/opt/keeper/moc_pipeline/pipeline.py
ENV PYTHON_BIN=python3
