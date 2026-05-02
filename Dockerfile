# Use the official .NET SDK image for building the app
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app

# Copy the project file and restore dependencies
COPY *.csproj ./
RUN dotnet restore

# Copy the rest of the application and build it
COPY . ./
RUN dotnet publish -c Release -o out

# Use the official .NET runtime image for running the app
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Create directory for uploads if it doesn't exist
RUN mkdir -p wwwroot/uploads/images wwwroot/uploads/audio

# Copy the build output from the build stage
COPY --from=build /app/out ./

# Copy the SQLite database file if it exists (or it will be created by migrations on start)
# Note: In production, you'd usually use a volume for this.
COPY app.db* ./

# Expose the port the app runs on
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# Start the application
ENTRYPOINT ["dotnet", "cha.dll"]
