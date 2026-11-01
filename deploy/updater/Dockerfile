FROM docker:29-cli

RUN apk add --no-cache git su-exec

COPY auto-update.sh /usr/local/bin/auto-update.sh
RUN sed -i 's/\r$//' /usr/local/bin/auto-update.sh && chmod 755 /usr/local/bin/auto-update.sh

ENTRYPOINT ["/usr/local/bin/auto-update.sh"]
