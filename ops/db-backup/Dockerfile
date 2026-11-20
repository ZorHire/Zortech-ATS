# Nightly pg_dump of the self-hosted ZorHire database, uploaded to Cloudflare R2.
FROM postgres:17-alpine
RUN apk add --no-cache aws-cli tzdata
COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh
ENTRYPOINT ["/usr/local/bin/backup.sh"]
CMD ["--daemon"]
