const assert = require('assert');
const _ = require('lodash');

const { Diagnostic } = require('../src/diagnostic');
const MQTT = require('../src/mqtt');
const Vehicle = require('../src/vehicle');
const apiResponse = require('./diagnostic.sample.json');

describe('MQTT', () => {
    let mqtt;
    let vehicle = new Vehicle({make: 'foo', model: 'bar', vin: 'XXX', year: 2020});
    beforeEach(() => mqtt = new MQTT(vehicle));

    it('should set defaults', () => {
        assert.strictEqual(mqtt.prefix, 'homeassistant');
        assert.strictEqual(mqtt.instance, 'XXX');
    });

    it('should convert names for mqtt topics', () => {
        assert.strictEqual(MQTT.convertName('foo bar'), 'foo_bar');
        assert.strictEqual(MQTT.convertName('foo bar bazz'), 'foo_bar_bazz');
        assert.strictEqual(MQTT.convertName('FOO BAR'), 'foo_bar');
        assert.strictEqual(MQTT.convertName('FOO BAR bazz'), 'foo_bar_bazz');
    });

    it('should convert names to be human readable', () => {
        assert.strictEqual(MQTT.convertFriendlyName('foo bar'), 'Foo Bar');
        assert.strictEqual(MQTT.convertFriendlyName('FOO BAR'), 'Foo Bar');
    });

    it('should determine sensor types', () => {
        assert.strictEqual(MQTT.determineSensorType('EV CHARGE STATE'), 'binary_sensor');
        assert.strictEqual(MQTT.determineSensorType('EV PLUG STATE'), 'binary_sensor');
        assert.strictEqual(MQTT.determineSensorType('PRIORITY CHARGE INDICATOR'), 'binary_sensor');
        assert.strictEqual(MQTT.determineSensorType('PRIORITY CHARGE STATUS'), 'binary_sensor');
        assert.strictEqual(MQTT.determineSensorType('getLocation'), 'device_tracker');
        assert.strictEqual(MQTT.determineSensorType('foo'), 'sensor');
        assert.strictEqual(MQTT.determineSensorType(''), 'sensor');
    });

    describe('topics', () => {
        let d;

        it('should generate availability topic', () => {
            assert.strictEqual(mqtt.getAvailabilityTopic(), 'homeassistant/XXX/available');
        });

        it('should generate command topic', () => {
            assert.strictEqual(mqtt.getCommandTopic(), 'homeassistant/XXX/command');
        });

        describe('sensor', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[0]')));

            it('should generate config topics', () => {
                assert.strictEqual(mqtt.getConfigTopic(d), 'homeassistant/sensor/XXX/ambient_air_temperature/config');
            });
            it('should generate state topics', () => {
                assert.strictEqual(mqtt.getStateTopic(d), 'homeassistant/sensor/XXX/ambient_air_temperature/state');
            });
        });

        describe('binary_sensor', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[3]')));
            it('should generate config topics', () => {
                assert.strictEqual(mqtt.getConfigTopic(d), 'homeassistant/binary_sensor/XXX/ev_charge_state/config');
            });
            it('should generate state topics', () => {
                assert.strictEqual(mqtt.getStateTopic(d.diagnosticElements[1]), 'homeassistant/binary_sensor/XXX/priority_charge_indicator/state');
            });
        });
    });

    describe('payloads', () => {
        let d;
        describe('sensor', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[0]')));
            it('should generate config payloads', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: 2020,
                        name: '2020 foo bar'
                    },
                    device_class: 'temperature',
                    json_attributes_template: undefined,
                    name: 'Ambient Air Temperature',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/ambient_air_temperature/state',
                    unique_id: 'xxx-ambient-air-temperature',
                    json_attributes_topic: undefined,
                    unit_of_measurement: '°C',
                    value_template: '{{ value_json.ambient_air_temperature }}'
                });
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[1]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: 2020,
                        name: '2020 foo bar'
                    },
                    device_class: 'temperature',
                    json_attributes_template: undefined,
                    name: 'Ambient Air Temperature F',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/ambient_air_temperature/state',
                    unique_id: 'xxx-ambient-air-temperature-f',
                    json_attributes_topic: undefined,
                    unit_of_measurement: '°F',
                    value_template: '{{ value_json.ambient_air_temperature_f }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    ambient_air_temperature: 15,
                    ambient_air_temperature_f: 59
                });
            });
        });

        describe('binary_sensor', () => { // TODO maybe not needed, payloads not diff
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[3]')));
            it('should generate config payloads', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[1]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: 2020,
                        name: '2020 foo bar'
                    },
                    device_class: undefined,
                    json_attributes_template: undefined,
                    name: 'Priority Charge Indicator',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    payload_off: false,
                    payload_on: true,
                    state_topic: 'homeassistant/binary_sensor/XXX/ev_charge_state/state',
                    unique_id: 'xxx-priority-charge-indicator',
                    json_attributes_topic: undefined,
                    value_template: '{{ value_json.priority_charge_indicator }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    ev_charge_state: false,
                    priority_charge_indicator: false,
                    priority_charge_status: false
                });
            });
        });

        describe('attributes', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[8]')));
            it('should generate payloads with an attribute', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: 2020,
                        name: '2020 foo bar'
                    },
                    device_class: 'pressure',
                    json_attributes_template: "{{ {'recommendation': value_json.tire_pressure_placard_front} | tojson }}",
                    name: 'Tire Pressure: Left Front',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/tire_pressure/state',
                    unique_id: 'xxx-tire-pressure-lf',
                    json_attributes_topic: 'homeassistant/sensor/XXX/tire_pressure/state',
                    unit_of_measurement: 'kPa',
                    value_template: '{{ value_json.tire_pressure_lf }}'
                });
            });
        });
    });
});
