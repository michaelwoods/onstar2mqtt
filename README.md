# onstar2mqtt
A service that utilizes the [OnStarJS](https://github.com/samrum/OnStarJS) library to expose OnStar data to MQTT topics.

The functionality is mostly focused around EVs (specifically the Bolt EV), however PRs for other vehicle types are certainly welcome.

There is no affiliation with this project and GM, Chevrolet nor OnStar. In fact, it would be nice if they'd even respond to development requests so we wouldn't have to reverse engineer their API.

## Running
Collect the following information:
1. [Generate](https://www.uuidgenerator.net/version4) a v4 uuid for the device ID
2. OnStar login: username, password, PIN
3. Your car's VIN. Easily found in the monthly OnStar diagnostic emails.
4. MQTT server information: hostname, username, password
    4a. If using TLS, define `MQTT_PORT` and `MQTT_TLS=true`


### Node.js
It's a typical node.js application, but I am unfamiliar on how to pass ENV vars, so if someone wants to create a PR to explain how to do that, be my guest. 
To install and run do the following commands.  
`sudo wget https://www.github.com/bennydabee/onstar2mqtt  
cd onstar2mqtt  
npm install  
`  
The following is required as I am unfamilar with the ENV vars for NPM.  
`  
cd src  
sudo nano index.js  
`  
Make the following lines similar to this  
`deviceId: process.env.ONSTAR_DEVICEID || 'uuidhere',  
vin: process.env.ONSTAR_VIN || 'vinhere',  
username: process.env.ONSTAR_USERNAME 'usernamehere',  
password: process.env.ONSTAR_PASSWORD 'password here',  
onStarPin: process.env.ONSTAR_PIN 'pinhere',  
`  
`  
const mqttConfig = {  
host: process.env.MQTT_HOST || 'haip',  
username: process.env.MQTT_USERNAME || 'mqttusername',  
password: process.env.MQTT_PASSWORD || 'mqttpassword',  
port: parseInt(process.env.MQTT_PORT) || 1883,  
tls: process.env.MQTT_TLS || false,  
prefix: process.env.MQTT_PREFIX || 'homeassistant',  
namePrefix: process.env.MQTT_NAME_PREFIX || '',  
`  
After all this run `cd ..` and then `npm run start` and it should now connect and you will have OnStarJS in your HA MQTT  

### Home Assistant configuration templates
MQTT auto discovery is enabled. For further integrations and screenshots see [HA-MQTT.md](HA-MQTT.md).

## Development
### Running
`npm run start`
### Testing
`npm run test`
### Coverage
`npm run coverage`
### Releases
`npm version [major|minor|patch] -m "Version %s" && git push --follow-tags`

Publish the release on GitHub to trigger a release build (ie, update 'latest' docker tag).
