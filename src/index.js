const OnStar = require('onstarjs');
const mqtt = require('async-mqtt');
const uuidv4 = require('uuid').v4;
const _ = require('lodash');
const Vehicle = require('./vehicle');
const { Diagnostic } = require('./diagnostic');

const onstarConfig = {
    deviceId: process.env.ONSTAR_DEVICEID || uuidv4(),
    vin: process.env.ONSTAR_VIN,
    username: process.env.ONSTAR_USERNAME,
    password: process.env.ONSTAR_PASSWORD,
    onStarPin: process.env.ONSTAR_PIN,
    checkRequestStatus: process.env.ONSTAR_SYNC == "true",
    refreshInterval: 30*60*1000 // 30min TODO: configurable
};

const mqttConfig = {
    host: process.env.MQTT_HOST,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    port: process.env.MQTT_PORT,
    tls: process.env.MQTT_TLS,
    prefix: process.env.MQTT_PREFIX,
};

const connectionHandler = async client => {
    
};

const messageHandler = async client => {
    
};

const run = async () => {
    const onStar = OnStar.create(onstarConfig);
    // const client = await mqtt.connectAsync(`${mqttConfig ? 'mqtt' : 'mqtts'}://${mqttConfig.host}:${mqttConfig.port}`, {
    //     username, password
    // } = mqttConfig);

    // connectionHandler();
    console.log('Requesting vehicles.');
    const vehiclesRes = await onStar.getAccountVehicles().catch(err => console.error(err));
    console.log(_.get(vehiclesRes, 'status'));
    const vehicles = _.map(
        _.get(vehiclesRes, 'response.data.vehicles.vehicle'),
        v => new Vehicle(v)
    );
    console.log('Vehicles returned:');

    // Note: the library is set to use only the configured VIN, but using multiple for future proofing.
    for (const v of vehicles) {
        console.log(v.toString());

        console.log('Requesting diagnostics:')
        const statsRes = await onStar.diagnostics({
            diagnosticItem: v.getSupported()
        }).catch(err => console.error(err));
        console.log(_.get(statsRes, 'status'));
        const stats = _.map(
            _.get(statsRes, 'response.data.commandResponse.body.diagnosticResponse'),
            d => new Diagnostic(d)
        );
        _.forEach(stats, s => console.log(s.toString()));
    }
};

run()
    .then(() => console.log('Done, exiting.'))
    .catch(e => console.error(e));
