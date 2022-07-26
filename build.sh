sudo docker build -t onstar2mqtt .
sudo docker-compose rm -sf
sudo docker-compose up -d
sudo docker system prune -f
