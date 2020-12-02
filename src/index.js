const OnStar = require('onstarjs');
const mqtt = require('async-mqtt');
const uuidv4 = require('uuid').v4;
const _ = require('lodash');
const Vehicle = require('./vehicle');
const {Diagnostic} = require('./diagnostic');
const MQTT = require('./mqtt');

const onstarConfig = {
    deviceId: process.env.ONSTAR_DEVICEID || uuidv4(),
    vin: process.env.ONSTAR_VIN,
    username: process.env.ONSTAR_USERNAME,
    password: process.env.ONSTAR_PASSWORD,
    onStarPin: process.env.ONSTAR_PIN,
    checkRequestStatus: process.env.ONSTAR_SYNC === "true" || true,
    refreshInterval: parseInt(process.env.ONSTAR_REFRESH) || (30 * 60 * 1000) // 30 min
};

const mqttConfig = {
    host: process.env.MQTT_HOST || 'localhost',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    port: parseInt(process.env.MQTT_PORT) || 1883,
    tls: process.env.MQTT_TLS || false,
    prefix: process.env.MQTT_PREFIX || 'homeassistant',
};

let loop;
(async () => {
    try {
        const onStar = OnStar.create(onstarConfig);
        const client = await mqtt.connectAsync(`${mqttConfig.tls
            ? 'mqtts' : 'mqtt'}://${mqttConfig.host}:${mqttConfig.port}`,
            { username: mqttConfig.username, password: mqttConfig.password });

        console.log('Requesting vehicles.');
        const vehiclesRes = await onStar.getAccountVehicles();
        console.log(_.get(vehiclesRes, 'status'));
        const vehicles = _.map(
            _.get(vehiclesRes, 'response.data.vehicles.vehicle'),
            v => new Vehicle(v)
        );
        console.log('Vehicles returned:');
        for (const v of vehicles) {
            console.log(v.toString());
        }
        const mqttHA = new MQTT('homeassistant', vehicles[0].vin);

        const run = async () => {
            // Note: the library is set to use only the configured VIN, but using multiple for future proofing.
            for (const v of vehicles) {
                console.log('Requesting diagnostics:')
                const statsRes = await onStar.diagnostics({
                    diagnosticItem: v.getSupported()
                });
                console.log(_.get(statsRes, 'status'));
                const stats = _.map(
                    _.get(statsRes, 'response.data.commandResponse.body.diagnosticResponse'),
                    d => new Diagnostic(d)
                );

                for (const s of stats) {
                    if (!s.hasElements()) {
                        continue;
                    }
                    // configure, then set state
                    for (const d of s.diagnosticElements) {
                        console.log(mqttHA.getConfigTopic(d));
                        console.log(JSON.stringify(mqttHA.getConfigPayload(s, d)));
                        await client.publish(mqttHA.getConfigTopic(d), JSON.stringify(mqttHA.getConfigPayload(s, d)));
                    }
                    console.log(mqttHA.getStateTopic(s));
                    console.log(JSON.stringify(mqttHA.getStatePayload(s)));
                    await client.publish(mqttHA.getStateTopic(s), JSON.stringify(mqttHA.getStatePayload(s)));
                }
            }
        };

        const main = () => run()
            .then(() => console.log('Done, sleeping.'))
            .catch(e => console.error(e))

        main();
        loop = setInterval(main, onstarConfig.refreshInterval);
    } catch (e) {
        console.error(e);
    }
})();