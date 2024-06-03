# Use an official Node.js runtime as a parent image
FROM node:14-slim

# Set the working directory to /app
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any needed packages
RUN npm ci

# Copy the rest of the application to the working directory
COPY . .

# Expose port 8080 for incoming requests
EXPOSE 8080

# Define the command to run your app
CMD [ "node", "src/server/server.js" ]