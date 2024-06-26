# Use a Node.js base image
FROM node:22.2.0

WORKDIR /usr/src/app

# Copy only package*.json first for efficient caching
COPY package*.json ./

# Install dependencies - bcrypt will be built here
RUN npm install 

# Copy the rest of the app code 
COPY . . 

# Expose the port 
EXPOSE 8080

# Start the application
CMD ["npm", "start"] 
