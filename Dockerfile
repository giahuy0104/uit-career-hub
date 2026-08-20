FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /workspace

COPY backend/.mvn backend/.mvn
COPY backend/mvnw backend/pom.xml backend/
RUN chmod +x backend/mvnw \
    && cd backend \
    && ./mvnw -B -DskipTests dependency:go-offline

COPY backend/src backend/src
COPY database database
RUN cd backend \
    && ./mvnw -B -DskipTests clean package

FROM eclipse-temurin:21-jre-alpine

RUN addgroup -S careerhub \
    && adduser -S careerhub -G careerhub

WORKDIR /app
COPY --from=build /workspace/backend/target/career-hub-api-0.0.1-SNAPSHOT.jar /app/app.jar

USER careerhub
EXPOSE 3000

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-XX:+ExitOnOutOfMemoryError", "-jar", "/app/app.jar"]
