# Use an official Node.js runtime as a parent image
FROM node:latest

# Set the working directory to /app
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any needed packages
RUN npm i

# Copy the rest of the application to the working directory
COPY . .

ENV PORT 8080
ENV HOST 0.0.0.0
EXPOSE 8080

# Define the command to run your app
CMD [ "npm", "run", "start" ]
