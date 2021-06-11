const OnStar = require('onstarjs');
const mqtt = require('async-mqtt');
const uuidv4 = require('uuid').v4;
const _ = require('lodash');
const Vehicle = require('./vehicle');
const {Diagnostic} = require('./diagnostic');
const MQTT = require('./mqtt');
const {Commands} = require('./commands');
const logger = require('./logger');


const onstarConfig = {
    deviceId: process.env.ONSTAR_DEVICEID || uuidv4(),
    vin: process.env.ONSTAR_VIN,
    username: process.env.ONSTAR_USERNAME,
    password: process.env.ONSTAR_PASSWORD,
    onStarPin: process.env.ONSTAR_PIN,
    checkRequestStatus: process.env.ONSTAR_SYNC === "true" || true,
    refreshInterval: parseInt(process.env.ONSTAR_REFRESH) || (30 * 60 * 1000), // 30 min
    allowCommands: _.toLower(_.get(process, 'env.ONSTAR_ALLOW_COMMANDS', 'true')) === 'true'
};
logger.info('OnStar Config', {onstarConfig});

const mqttConfig = {
    host: process.env.MQTT_HOST || 'localhost',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    port: parseInt(process.env.MQTT_PORT) || 1883,
    tls: process.env.MQTT_TLS || false,
    prefix: process.env.MQTT_PREFIX || 'homeassistant',
};
logger.info('MQTT Config', {mqttConfig});

const init = () =>  new Commands(OnStar.create(onstarConfig));

const getVehicles = async commands => {
    logger.info('Requesting vehicles');
    const vehiclesRes = await commands.getAccountVehicles();
    logger.info('Vehicle request status', {status: _.get(vehiclesRes, 'status')});
    const vehicles = _.map(
        _.get(vehiclesRes, 'response.data.vehicles.vehicle'),
        v => new Vehicle(v)
    );
    logger.debug('Vehicle request response', {vehicles: _.map(vehicles, v => v.toString())});
    return vehicles;
}

const connectMQTT = async availabilityTopic => {
    const url = `${mqttConfig.tls ? 'mqtts' : 'mqtt'}://${mqttConfig.host}:${mqttConfig.port}`;
    const config = {
        username: mqttConfig.username,
        password: mqttConfig.password,
        will: {topic: availabilityTopic, payload: 'false', retain: true}
    };
    logger.info('Connecting to MQTT', {url, config: _.omit(config, 'password')});
    const client = await mqtt.connectAsync(url, config);
    logger.info('Connected to MQTT');
    return client;
}

const configureMQTT = async (commands, client, mqttHA) => {
    if (!onstarConfig.allowCommands)
        return;

    client.on('message', (topic, message) => {
        logger.debug('Subscription message', {topic, message});
        const {command, options} = JSON.parse(message);
        const commandFn = commands[command].bind(commands);
        logger.info('Command sent', {command});
        commandFn(options || {})
            .then(() => logger.info('Command completed', {command}))
            .catch(err=> logger.error('Command error', {command, err}));
    });
    const topic = mqttHA.getCommandTopic();
    logger.info('Subscribed to command topic', {topic});
    await client.subscribe(topic);
};

(async () => {
    try {
        const commands = init();
        const vehicles = await getVehicles(commands);

        const mqttHA = new MQTT(vehicles[0], 'homeassistant');
        const availTopic = mqttHA.getAvailabilityTopic();
        const client = await connectMQTT(availTopic);
        await configureMQTT(commands, client, mqttHA);

        const configurations = new Map();
        const run = async () => {
            const states = new Map();
            const v = vehicles[0];
            logger.info('Requesting diagnostics');
            const statsRes = await commands.diagnostics({diagnosticItem: v.getSupported()});
            logger.info('Diagnostic request status', {status: _.get(statsRes, 'status')});
            const stats = _.map(
                _.get(statsRes, 'response.data.commandResponse.body.diagnosticResponse'),
                d => new Diagnostic(d)
            );
            logger.debug('Diagnostic request response', {stats: _.map(stats, s => s.toString())});

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
            const publishes = [];
            // publish sensor configs
            for (let [topic, config] of configurations) {
                // configure once
                if (!config.configured) {
                    config.configured = true;
                    const {payload} = config;
                    logger.info('Publishing message', {topic, payload});
                    publishes.push(
                        client.publish(topic, JSON.stringify(payload), {retain: true})
                    );
                }
            }
            // update sensor states
            for (let [topic, state] of states) {
                logger.info('Publishing message', {topic, state});
                publishes.push(
                    client.publish(topic, JSON.stringify(state), {retain: true})
                );
            }
            await Promise.all(publishes);
        };

        const main = async () => run()
            .then(() => logger.info('Updates complete, sleeping.'))
            .catch(e => logger.error('Error', {error: e}))

        await main();
        setInterval(main, onstarConfig.refreshInterval);
    } catch (e) {
        logger.error('Main function error.', {error: e});
    }
})();
