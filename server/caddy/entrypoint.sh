#!/bin/sh
set -eu

domain="${KEEPER_API_DOMAIN:-localhost}"
cert="/data/keeper-self-signed.crt"
key="/data/keeper-self-signed.key"

if [ "$domain" = "localhost" ]; then
	san="DNS:localhost,IP:127.0.0.1"
elif echo "$domain" | grep -Eq '^[0-9]+(\.[0-9]+){3}$'; then
	san="IP:$domain"
else
	san="DNS:$domain"
fi

if [ ! -f "$cert" ] || [ ! -f "$key" ]; then
	openssl req \
		-x509 \
		-newkey rsa:2048 \
		-sha256 \
		-days 3650 \
		-nodes \
		-keyout "$key" \
		-out "$cert" \
		-subj "/CN=$domain" \
		-addext "subjectAltName=$san"
fi

exec "$@"
