FROM lipanski/docker-static-website:latest

# Copy the static website
# Use the .dockerignore file to control what ends up inside the image!
COPY ./build .
COPY ./httpd.conf /etc/httpd.conf

# Run BusyBox httpd
CMD ["/busybox-httpd", "-f", "-v", "-p", "3000"]