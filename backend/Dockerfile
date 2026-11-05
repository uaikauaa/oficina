FROM maven:3.9.11-eclipse-temurin-21-alpine@sha256:922927df2c662cdd47ddb116443d6bec4696cfae3de1a0ddac8fcc7b87ce61ae AS build

WORKDIR /workspace
COPY pom.xml ./
RUN mvn -B -ntp dependency:go-offline
COPY src/main ./src/main
ARG SOURCE_DATE_EPOCH=1793750400
RUN mvn -B -ntp package -Dmaven.test.skip=true -Dproject.build.outputTimestamp=${SOURCE_DATE_EPOCH}

FROM eclipse-temurin:21-jre-alpine@sha256:82cf3d9ccbe1ed46252008d51b2f2329e6b9e8a2f4394c4bebefc3ea7f4b1372 AS runtime

# The pinned upstream image predates Alpine's libexpat security update.
# Pin only the corrected package; a missing version must fail the build.
RUN apk add --no-cache 'libexpat=2.10.0-r0' && rm -f /var/log/apk.log

ARG SOURCE_REVISION=development
LABEL org.opencontainers.image.source="https://github.com/uaikauaa/oficina" \
      org.opencontainers.image.revision=${SOURCE_REVISION}
WORKDIR /app
COPY --from=build --chown=10001:10001 /workspace/target/backend-0.0.1-SNAPSHOT.jar ./app.jar

USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT:-${SERVER_PORT:-8080}}/api/health || exit 1

ENTRYPOINT ["java", "-Djava.awt.headless=true", "-jar", "/app/app.jar"]
