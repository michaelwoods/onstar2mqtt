#!/usr/bin/with-contenv bashio
set +u

export ONSTAR_DEVICEID=$(bashio::config 'ONSTAR_DEVICEID')
export ONSTAR_VIN=$(bashio::config 'ONSTAR_VIN')
export ONSTAR_USERNAME=$(bashio::config 'ONSTAR_USERNAME')
export ONSTAR_PASSWORD=$(bashio::config 'ONSTAR_PASSWORD')
export ONSTAR_PIN=$(bashio::config 'ONSTAR_PIN')
export ONSTAR_URL=$(bashio::config 'ONSTAR_URL')
export ONSTAR_REFRESH=$(bashio::config 'ONSTAR_REFRESH')
export MQTT_HOST=$(bashio::config 'MQTT_HOST')
export MQTT_USERNAME=$(bashio::config 'MQTT_USERNAME')
export MQTT_PASSWORD=$(bashio::config 'MQTT_PASSWORD')

bashio::log.info "Starting OnStar2MQTT..."
npm run start
