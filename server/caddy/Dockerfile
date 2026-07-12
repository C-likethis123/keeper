FROM caddy:2-alpine

RUN apk add --no-cache openssl

COPY entrypoint.sh /usr/bin/keeper-caddy-entrypoint
RUN chmod +x /usr/bin/keeper-caddy-entrypoint

ENTRYPOINT ["/usr/bin/keeper-caddy-entrypoint"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
