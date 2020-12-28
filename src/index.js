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

        const mqttHA = new MQTT(vehicles[0], 'homeassistant');
        const availTopic = mqttHA.getAvailabilityTopic();
        const client = await mqtt.connectAsync(`${mqttConfig.tls
            ? 'mqtts' : 'mqtt'}://${mqttConfig.host}:${mqttConfig.port}`, {
            username: mqttConfig.username,
            password: mqttConfig.password,
            will: {topic: availTopic, payload: 'false', retain: true}
        });

        await client.publish(availTopic, 'true', {retain: true});

        const configurations = new Map();
        const run = async () => {
            const states = new Map();
            const v = vehicles[0];
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
                // configure once, then set or update states
                for (const d of s.diagnosticElements) {
                    const topic = mqttHA.getConfigTopic(d)
                    const payload = mqttHA.getConfigPayload(s, d);
                    configurations.set(topic, {configured: false, payload});
                }

                const topic = mqttHA.getStateTopic(s);
                const payload = mqttHA.getStatePayload(s);
                states.set(topic, payload);
            }
            // publish configs
            for (let [topic, config] of configurations) {
                // configure once
                if (!config.configured) {
                    config.configured = true;
                    const {payload} = config;
                    console.log(`${topic} ${JSON.stringify(payload)}`);
                    await client.publish(topic, JSON.stringify(payload), {retain: true});
                }
            }
            // update states
            for (let [topic, state] of states) {
                console.log(`${topic} ${JSON.stringify(state)}`);
                await client.publish(topic, JSON.stringify(state), {retain: true});
            }
        };

        const main = () => run()
            .then(() => console.log('Done, sleeping.'))
            .catch(e => console.error(e))

        await main();
        loop = setInterval(main, onstarConfig.refreshInterval);
    } catch (e) {
        console.error(e);
    }
})();