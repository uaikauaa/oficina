FROM nginx:1.30.7-alpine3.24@sha256:caf4e1e032a20f9c3c5e28fc7f25ffd768ad8677b4975c54193075997b3a97e3

RUN apk add --no-cache 'libcrypto3=3.5.9-r1' 'libssl3=3.5.9-r1' 'zlib=1.4-r0' && apk del nginx-module-xslt nginx-module-njs libxml2 && rm -f /var/log/apk.log

COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf
COPY cloudflare-realip.conf /etc/nginx/cloudflare-realip.conf

RUN chown -R nginx:nginx /etc/nginx /var/cache/nginx \
    && touch /tmp/nginx.pid \
    && chown nginx:nginx /tmp/nginx.pid

USER nginx
EXPOSE 8080 8443
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/nginx-health || exit 1
