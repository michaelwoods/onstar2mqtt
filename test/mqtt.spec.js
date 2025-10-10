const assert = require('assert');
const _ = require('lodash');

const { Diagnostic, AdvancedDiagnostic } = require('../src/diagnostic');
const MQTT = require('../src/mqtt');
const Vehicle = require('../src/vehicle');
const apiResponse = require('./diagnostic.sample.json');
const apiV3Response = require('./diagnostic-sample-anonymized-v3-1.json');

describe('MQTT', () => {
    let mqtt;
    let vehicle = new Vehicle({ make: 'foo', model: 'bar', vin: 'XXX', year: 2020 });
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
        assert.strictEqual(MQTT.determineSensorType('EXHST FL LEVL WARN STATUS'), 'sensor');
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

        it('should generate polling status topic', () => {
            assert.strictEqual(mqtt.getPollingStatusTopic(), 'homeassistant/XXX/polling_status');
        });

        it('should generate refresh interval topic', () => {
            assert.strictEqual(mqtt.getRefreshIntervalTopic(), 'homeassistant/XXX/refresh_interval');
        });

        it('should generate command topic', () => {
            assert.strictEqual(mqtt.getRefreshIntervalCurrentValTopic(), 'homeassistant/XXX/refresh_interval_current_val');
        });

        it('should generate command topic', () => {
            assert.strictEqual(mqtt.getDeviceTrackerConfigTopic(), 'homeassistant/device_tracker/XXX/config');
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

    describe('addNamePrefix', () => {
        it('should return the original name when namePrefix is not set', () => {
            mqtt.namePrefix = null;
            const name = 'TestName';
            const result = mqtt.addNamePrefix(name);
            assert.strictEqual(result, name);
        });

        it('should return the name with prefix when namePrefix is set', () => {
            mqtt.namePrefix = 'Prefix';
            const name = 'TestName';
            const expected = 'Prefix TestName';
            const result = mqtt.addNamePrefix(name);
            assert.strictEqual(result, expected);
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
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    //message: 'na',
                    state_class: 'measurement',
                    device_class: 'temperature',
                    icon: 'mdi:thermometer',
                    json_attributes_template: "{{ {'last_updated': value_json.ambient_air_temperature_last_updated} | tojson }}",
                    name: 'Ambient Air Temperature',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/ambient_air_temperature/state',
                    unique_id: 'xxx-ambient-air-temperature',
                    json_attributes_topic: 'homeassistant/sensor/XXX/ambient_air_temperature/state',
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
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    //message: 'na',
                    state_class: 'measurement',
                    device_class: 'temperature',
                    icon: 'mdi:thermometer',
                    json_attributes_template: "{{ {'last_updated': value_json.ambient_air_temperature_f_last_updated} | tojson }}",
                    name: 'Ambient Air Temperature F',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/ambient_air_temperature/state',
                    unique_id: 'xxx-ambient-air-temperature-f',
                    json_attributes_topic: 'homeassistant/sensor/XXX/ambient_air_temperature/state',
                    unit_of_measurement: '°F',
                    value_template: '{{ value_json.ambient_air_temperature_f }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    ambient_air_temperature: 15,
                    ambient_air_temperature_f: 59,
                    ambient_air_temperature_f_message: 'na',
                    ambient_air_temperature_f_status: 'NA',
                    ambient_air_temperature_message: 'na',
                    ambient_air_temperature_status: 'NA'
                    //ambient_air_temperature: 15,
                    //ambient_air_temperature_f: 59
                });
            });
        });

        describe('sensor', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[7]')));
            it('should generate config payloads', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: 'total_increasing',
                    device_class: 'distance',
                    icon: 'mdi:counter',
                    json_attributes_template: "{{ {'last_updated': value_json.odometer_last_updated} | tojson }}",
                    name: 'Odometer',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/odometer/state',
                    unique_id: 'xxx-odometer',
                    json_attributes_topic: 'homeassistant/sensor/XXX/odometer/state',
                    unit_of_measurement: 'km',
                    value_template: '{{ value_json.odometer }}'
                });
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[1]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: 'total_increasing',
                    device_class: 'distance',
                    icon: 'mdi:counter',
                    json_attributes_template: "{{ {'last_updated': value_json.odometer_mi_last_updated} | tojson }}",
                    name: 'Odometer Mi',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/odometer/state',
                    unique_id: 'xxx-odometer-mi',
                    json_attributes_topic: 'homeassistant/sensor/XXX/odometer/state',
                    unit_of_measurement: 'mi',
                    value_template: '{{ value_json.odometer_mi }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    odometer: 6013.8,
                    odometer_message: "na",
                    odometer_mi: 3736.8,
                    odometer_mi_message: "na",
                    odometer_mi_status: "NA",
                    odometer_status: "NA"
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
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    //message: 'na',                      
                    state_class: undefined,
                    device_class: undefined,
                    icon: 'mdi:battery-charging-high',
                    json_attributes_template: "{{ {'last_updated': value_json.priority_charge_indicator_last_updated} | tojson }}",
                    name: 'Priority Charge Indicator',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    payload_off: false,
                    payload_on: true,
                    state_topic: 'homeassistant/binary_sensor/XXX/ev_charge_state/state',
                    unique_id: 'xxx-priority-charge-indicator',
                    json_attributes_topic: 'homeassistant/binary_sensor/XXX/ev_charge_state/state',
                    value_template: '{{ value_json.priority_charge_indicator }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    ev_charge_state: false,
                    ev_charge_state_message: 'charging_complete',
                    ev_charge_state_status: 'NA',
                    priority_charge_indicator: false,
                    priority_charge_indicator_message: 'na',
                    priority_charge_indicator_status: 'NA',
                    priority_charge_status: false,
                    priority_charge_status_message: 'na',
                    priority_charge_status_status: 'NA'
                    //ev_charge_state: false,
                    //priority_charge_indicator: false,
                    //priority_charge_status: false
                });
            });
        });

        /*        describe('attributes', () => {
                    beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[8]')));
                    it('should generate payloads with an attribute', () => {
                        assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                            availability_topic: 'homeassistant/XXX/available',
                            device: {
                                identifiers: [
                                    'XXX'
                                ],
                                manufacturer: 'foo',
                                model: '2020 bar',
                                name: '2020 foo bar'
                            },
                            //message: 'YELLOW',
                            state_class: 'measurement',
                            device_class: 'pressure',
                            json_attributes_template: "{{ {'recommendation': value_json.tire_pressure_placard_front, 'message': value_json.tire_pressure_lf_message} | tojson }}",
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
                }); */

        describe('attributes', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[8]')));
            it('should generate payloads with an attribute for left front tire', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },

                    state_class: 'measurement',
                    device_class: 'pressure',
                    icon: 'mdi:car-tire-alert',
                    json_attributes_template: "{{ {'recommendation': value_json.tire_pressure_placard_front, 'message': value_json.tire_pressure_lf_message, 'last_updated': value_json.tire_pressure_lf_last_updated} | tojson }}",
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
            it('should generate payloads with an attribute for right front tire', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[4]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },

                    state_class: 'measurement',
                    device_class: 'pressure',
                    icon: 'mdi:car-tire-alert',
                    json_attributes_template: "{{ {'recommendation': value_json.tire_pressure_placard_front, 'message': value_json.tire_pressure_rf_message, 'last_updated': value_json.tire_pressure_rf_last_updated} | tojson }}",
                    name: 'Tire Pressure: Right Front',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/tire_pressure/state',
                    unique_id: 'xxx-tire-pressure-rf',
                    json_attributes_topic: 'homeassistant/sensor/XXX/tire_pressure/state',
                    unit_of_measurement: 'kPa',
                    value_template: '{{ value_json.tire_pressure_rf }}'
                });
            });
            it('should generate payloads with an attribute for left rear tire', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[1]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },

                    state_class: 'measurement',
                    device_class: 'pressure',
                    icon: 'mdi:car-tire-alert',
                    json_attributes_template: "{{ {'recommendation': value_json.tire_pressure_placard_rear, 'message': value_json.tire_pressure_lr_message, 'last_updated': value_json.tire_pressure_lr_last_updated} | tojson }}",
                    name: 'Tire Pressure: Left Rear',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/tire_pressure/state',
                    unique_id: 'xxx-tire-pressure-lr',
                    json_attributes_topic: 'homeassistant/sensor/XXX/tire_pressure/state',
                    unit_of_measurement: 'kPa',
                    value_template: '{{ value_json.tire_pressure_lr }}'
                });
            });
            it('should generate payloads with an attribute for right rear tire', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[5]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },

                    state_class: 'measurement',
                    device_class: 'pressure',
                    icon: 'mdi:car-tire-alert',
                    json_attributes_template: "{{ {'recommendation': value_json.tire_pressure_placard_rear, 'message': value_json.tire_pressure_rr_message, 'last_updated': value_json.tire_pressure_rr_last_updated} | tojson }}",
                    name: 'Tire Pressure: Right Rear',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/tire_pressure/state',
                    unique_id: 'xxx-tire-pressure-rr',
                    json_attributes_topic: 'homeassistant/sensor/XXX/tire_pressure/state',
                    unit_of_measurement: 'kPa',
                    value_template: '{{ value_json.tire_pressure_rr }}'
                });
            });
        });

        describe('attributes', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[10]')));
            it('should generate payloads with an attribute', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    //message: 'YELLOW',
                    state_class: 'measurement',
                    device_class: undefined,
                    icon: 'mdi:oil',
                    json_attributes_template: "{{ {'message': value_json.oil_life_message, 'last_updated': value_json.oil_life_last_updated} | tojson }}",
                    name: 'Oil Life',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/oil_life/state',
                    unique_id: 'xxx-oil-life',
                    json_attributes_topic: 'homeassistant/sensor/XXX/oil_life/state',
                    unit_of_measurement: '%',
                    value_template: '{{ value_json.oil_life }}'
                });
            });
        });

        describe('sensor', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[11]')));
            it('should generate config payloads', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: 'measurement',
                    device_class: 'volume_storage',
                    icon: 'mdi:gas-station',
                    json_attributes_template: "{{ {'last_updated': value_json.fuel_amount_last_updated} | tojson }}",
                    name: 'Fuel Amount',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/fuel_tank_info/state',
                    unique_id: 'xxx-fuel-amount',
                    json_attributes_topic: 'homeassistant/sensor/XXX/fuel_tank_info/state',
                    unit_of_measurement: 'L',
                    value_template: '{{ value_json.fuel_amount }}'
                });
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[1]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: 'measurement',
                    device_class: 'volume_storage',
                    icon: 'mdi:gas-station',
                    json_attributes_template: "{{ {'last_updated': value_json.fuel_capacity_last_updated} | tojson }}",
                    name: 'Fuel Capacity',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/fuel_tank_info/state',
                    unique_id: 'xxx-fuel-capacity',
                    json_attributes_topic: 'homeassistant/sensor/XXX/fuel_tank_info/state',
                    unit_of_measurement: 'L',
                    value_template: '{{ value_json.fuel_capacity }}'
                });
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[2]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: 'measurement',
                    device_class: undefined,
                    icon: 'mdi:gas-station',
                    json_attributes_template: "{{ {'status': value_json.fuel_level_status, 'status_color': value_json.fuel_level_status_color, 'last_updated': value_json.fuel_level_last_updated} | tojson }}",
                    name: 'Fuel Level',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/fuel_tank_info/state',
                    unique_id: 'xxx-fuel-level',
                    json_attributes_topic: 'homeassistant/sensor/XXX/fuel_tank_info/state',
                    unit_of_measurement: '%',
                    value_template: '{{ value_json.fuel_level }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    fuel_amount: 19.98,
                    fuel_amount_gal: 5.3,
                    fuel_amount_gal_message: "na",
                    fuel_amount_gal_status: "NA",
                    fuel_amount_message: "na",
                    fuel_amount_status: "NA",
                    fuel_capacity: 60,
                    fuel_capacity_gal: 15.9,
                    fuel_capacity_gal_message: "na",
                    fuel_capacity_gal_status: "NA",
                    fuel_capacity_message: "na",
                    fuel_capacity_status: "NA",
                    fuel_level: 33.3,
                    fuel_level_in_gal: 19.98,
                    fuel_level_in_gal_gal: 5.3,
                    fuel_level_in_gal_gal_message: "na",
                    fuel_level_in_gal_gal_status: "NA",
                    fuel_level_in_gal_message: "na",
                    fuel_level_in_gal_status: "NA",
                    fuel_level_message: "na",
                    fuel_level_status: "NA"
                });
            });
        });

        describe('attributes', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[12]')));
            it('should generate payloads with an attribute', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: 'measurement',
                    device_class: undefined,
                    icon: 'mdi:leaf-circle',
                    json_attributes_template: "{{ {'last_updated': value_json.lifetime_fuel_econ_last_updated} | tojson }}",
                    name: 'Lifetime Fuel Econ',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/lifetime_fuel_econ/state',
                    unique_id: 'xxx-lifetime-fuel-econ',
                    json_attributes_topic: 'homeassistant/sensor/XXX/lifetime_fuel_econ/state',
                    unit_of_measurement: 'km/L',
                    value_template: '{{ value_json.lifetime_fuel_econ }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    lifetime_fuel_econ: 11.86,
                    lifetime_fuel_econ_message: "na",
                    lifetime_fuel_econ_mpg: 27.9,
                    lifetime_fuel_econ_mpg_message: "na",
                    lifetime_fuel_econ_mpg_status: "NA",
                    lifetime_fuel_econ_status: "NA"
                });
            });
        });

        describe('attributes', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[13]')));
            it('should generate payloads with an attribute', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: 'total_increasing',
                    device_class: 'volume',
                    icon: 'mdi:gas-station',
                    json_attributes_template: "{{ {'last_updated': value_json.lifetime_fuel_used_last_updated} | tojson }}",
                    name: 'Lifetime Fuel Used',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/lifetime_fuel_used/state',
                    unique_id: 'xxx-lifetime-fuel-used',
                    json_attributes_topic: 'homeassistant/sensor/XXX/lifetime_fuel_used/state',
                    unit_of_measurement: 'L',
                    value_template: '{{ value_json.lifetime_fuel_used }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    lifetime_fuel_used: 4476.94,
                    lifetime_fuel_used_gal: 1182.7,
                    lifetime_fuel_used_gal_message: "na",
                    lifetime_fuel_used_gal_status: "NA",
                    lifetime_fuel_used_message: "na",
                    lifetime_fuel_used_status: "NA"
                });
            });
        });

        describe('attributes', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[4]')));
            it('should generate payloads with an attribute', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: undefined,
                    device_class: 'plug',
                    icon: 'mdi:ev-plug-type1',
                    json_attributes_template: "{{ {'last_updated': value_json.ev_plug_state_last_updated} | tojson }}",
                    name: 'Ev Plug State',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    payload_off: false,
                    payload_on: true,
                    state_topic: 'homeassistant/binary_sensor/XXX/ev_plug_state/state',
                    unique_id: 'xxx-ev-plug-state',
                    json_attributes_topic: 'homeassistant/binary_sensor/XXX/ev_plug_state/state',
                    value_template: '{{ value_json.ev_plug_state }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    ev_plug_state: true,
                    ev_plug_state_message: "plugged",
                    ev_plug_state_status: "NA"
                });
            });
        });

        describe('attributes', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[1]')));
            it('should generate payloads with an attribute', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: undefined,
                    device_class: undefined,
                    icon: 'mdi:flash',
                    json_attributes_template: "{{ {'last_updated': value_json.charger_power_level_last_updated} | tojson }}",
                    name: 'Charger Power Level',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/charger_power_level/state',
                    unique_id: 'xxx-charger-power-level',
                    unit_of_measurement: undefined,
                    json_attributes_topic: 'homeassistant/sensor/XXX/charger_power_level/state',
                    value_template: '{{ value_json.charger_power_level }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    charger_power_level: 'NO_REDUCTION',
                    charger_power_level_message: 'na',
                    charger_power_level_status: 'NA'
                });
            });
        });

        describe('attributes', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[2]')));
            it('should generate payloads with an attribute', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: 'measurement',
                    device_class: undefined,
                    icon: 'mdi:leaf-circle',
                    json_attributes_template: "{{ {'last_updated': value_json.electric_economy_last_updated} | tojson }}",
                    name: 'Electric Economy',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/energy_efficiency/state',
                    unique_id: 'xxx-electric-economy',
                    json_attributes_topic: 'homeassistant/sensor/XXX/energy_efficiency/state',
                    unit_of_measurement: 'kWh',
                    value_template: '{{ value_json.electric_economy }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    electric_economy: 21.85,
                    electric_economy_message: "na",
                    electric_economy_status: "NA",
                    lifetime_efficiency: 21.85,
                    lifetime_efficiency_message: "na",
                    lifetime_efficiency_status: "NA",
                    lifetime_mpge: 40.73,
                    lifetime_mpge_message: "na",
                    lifetime_mpge_mpge: 95.8,
                    lifetime_mpge_mpge_message: "na",
                    lifetime_mpge_mpge_status: "NA",
                    lifetime_mpge_status: "NA",
                    odometer: 6013.8,
                    odometer_message: "na",
                    odometer_mi: 3736.8,
                    odometer_mi_message: "na",
                    odometer_mi_status: "NA",
                    odometer_status: "NA",
                });
            });
        });

        describe('attributes', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[9]')));
            it('should generate payloads with an attribute', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: 'measurement',
                    device_class: 'distance',
                    icon: 'mdi:ev-station',
                    json_attributes_template: "{{ {'last_updated': value_json.ev_range_last_updated} | tojson }}",
                    name: 'Ev Range',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    state_topic: 'homeassistant/sensor/XXX/vehicle_range/state',
                    unique_id: 'xxx-ev-range',
                    unit_of_measurement: 'km',
                    json_attributes_topic: 'homeassistant/sensor/XXX/vehicle_range/state',
                    value_template: '{{ value_json.ev_range }}'
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    ev_range: 341,
                    ev_range_message: 'na',
                    ev_range_mi: 211.9,
                    ev_range_mi_message: 'na',
                    ev_range_mi_status: 'NA',
                    ev_range_status: 'NA',
                });
            });
        });

        describe('attributes', () => {
            beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[3]')));
            it('should generate payloads with an attribute', () => {
                assert.deepStrictEqual(mqtt.getConfigPayload(d, d.diagnosticElements[0]), {
                    availability_topic: 'homeassistant/XXX/available',
                    device: {
                        identifiers: [
                            'XXX'
                        ],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: "2020 foo bar Sensors",
                    },
                    state_class: undefined,
                    device_class: 'battery_charging',
                    icon: 'mdi:battery-charging',
                    json_attributes_template: "{{ {'last_updated': value_json.ev_charge_state_last_updated} | tojson }}",
                    name: 'Ev Charge State',
                    payload_available: 'true',
                    payload_not_available: 'false',
                    payload_off: false,
                    payload_on: true,
                    state_topic: 'homeassistant/binary_sensor/XXX/ev_charge_state/state',
                    unique_id: 'xxx-ev-charge-state',
                    json_attributes_topic: 'homeassistant/binary_sensor/XXX/ev_charge_state/state',
                    value_template: "{{ value_json.ev_charge_state }}",
                });
            });
            it('should generate state payloads', () => {
                assert.deepStrictEqual(mqtt.getStatePayload(d), {
                    ev_charge_state: false,
                    ev_charge_state_message: "charging_complete",
                    ev_charge_state_status: "NA",
                    priority_charge_indicator: false,
                    priority_charge_indicator_message: "na",
                    priority_charge_indicator_status: "NA",
                    priority_charge_status: false,
                    priority_charge_status_message: "na",
                    priority_charge_status_status: "NA",
                });
            });
        });


        describe('createCommandStatusSensorConfigPayload', () => {
            it('should generate command status sensor config payload when listAllSensorsTogether is true', () => {
                const command = 'lock';
                const listAllSensorsTogether = true;
                const expectedConfigPayload = {
                    topic: "homeassistant/sensor/XXX/lock_status_monitor/config",
                    payload: {
                        availability: {
                            payload_available: 'true',
                            payload_not_available: 'false',
                            topic: "homeassistant/XXX/available",
                        },
                        device: {
                            identifiers: [
                                'XXX'
                            ],
                            manufacturer: 'foo',
                            model: '2020 bar',
                            name: '2020 foo bar',
                            suggested_area: "2020 foo bar",
                        },
                        icon: 'mdi:message-alert',
                        name: 'Command lock Status Monitor',
                        state_topic: 'homeassistant/XXX/command/lock/state',
                        unique_id: 'xxx_lock_command_status_monitor',
                        value_template: '{{ value_json.command.error.message }}',
                    }
                };
                const result = mqtt.createCommandStatusSensorConfigPayload(command, listAllSensorsTogether);
                assert.deepStrictEqual(result, expectedConfigPayload);
            });

            it('should generate command status sensor config payload when listAllSensorsTogether is false', () => {
                const command = 'lock';
                const listAllSensorsTogether = false;
                const expectedConfigPayload = {
                    topic: "homeassistant/sensor/XXX/lock_status_monitor/config",
                    payload: {
                        availability: {
                            payload_available: 'true',
                            payload_not_available: 'false',
                            topic: "homeassistant/XXX/available",
                        },
                        device: {
                            identifiers: [
                                'XXX_Command_Status_Monitor'
                            ],
                            manufacturer: 'foo',
                            model: '2020 bar',
                            name: '2020 foo bar Command Status Monitor Sensors',
                            suggested_area: "2020 foo bar Command Status Monitor Sensors",
                        },
                        icon: 'mdi:message-alert',
                        name: 'Command lock Status Monitor',
                        state_topic: 'homeassistant/XXX/command/lock/state',
                        unique_id: 'xxx_lock_command_status_monitor',
                        value_template: '{{ value_json.command.error.message }}',
                    }
                };
                const result = mqtt.createCommandStatusSensorConfigPayload(command, listAllSensorsTogether);
                assert.deepStrictEqual(result, expectedConfigPayload);
            });
        });


        describe('createCommandStatusSensorTimestampConfigPayload', () => {
            it('should generate command status sensor timestamp config payload when listAllSensorsTogether is true', () => {
                const command = 'lock';
                const listAllSensorsTogether = true;
                const expectedConfigPayload = {
                    topic: "homeassistant/sensor/XXX/lock_status_timestamp/config",
                    payload: {
                        availability: {
                            payload_available: 'true',
                            payload_not_available: 'false',
                            topic: "homeassistant/XXX/available"
                        },
                        device: {
                            identifiers: [
                                'XXX'
                            ],
                            manufacturer: 'foo',
                            model: '2020 bar',
                            name: '2020 foo bar',
                            suggested_area: "2020 foo bar",
                        },
                        device_class: "timestamp",
                        icon: "mdi:calendar-clock",
                        name: 'Command lock Status Monitor Timestamp',
                        state_topic: 'homeassistant/XXX/command/lock/state',
                        unique_id: 'xxx_lock_command_status_timestamp_monitor',
                        value_template: '{{ value_json.completionTimestamp }}',
                    }
                };
                const result = mqtt.createCommandStatusSensorTimestampConfigPayload(command, listAllSensorsTogether);
                assert.deepStrictEqual(result, expectedConfigPayload);
            });

            it('should generate command status sensor timestamp config payload when listAllSensorsTogether is false', () => {
                const command = 'lock';
                const listAllSensorsTogether = false;
                const expectedConfigPayload = {
                    topic: "homeassistant/sensor/XXX/lock_status_timestamp/config",
                    payload: {
                        availability: {
                            payload_available: 'true',
                            payload_not_available: 'false',
                            topic: "homeassistant/XXX/available"
                        },
                        device: {
                            identifiers: [
                                'XXX_Command_Status_Monitor'
                            ],
                            manufacturer: 'foo',
                            model: '2020 bar',
                            name: '2020 foo bar Command Status Monitor Sensors',
                            suggested_area: "2020 foo bar Command Status Monitor Sensors",
                        },
                        device_class: "timestamp",
                        icon: "mdi:calendar-clock",
                        name: 'Command lock Status Monitor Timestamp',
                        state_topic: 'homeassistant/XXX/command/lock/state',
                        unique_id: 'xxx_lock_command_status_timestamp_monitor',
                        value_template: '{{ value_json.completionTimestamp }}',
                    }
                };
                const result = mqtt.createCommandStatusSensorTimestampConfigPayload(command, listAllSensorsTogether);
                assert.deepStrictEqual(result, expectedConfigPayload);
            });
        });

        describe('createPollingStatusMessageSensorConfigPayload', () => {
            it('should generate the correct sensor config payload for polling status message when listAllSensorsTogether is true', () => {
                const pollingStatusTopicState = 'homeassistant/XXX/polling_status/state';
                const listAllSensorsTogether = true;
                const expectedTopic = 'homeassistant/sensor/XXX/polling_status_message/config';
                const expectedPayload = {
                    "device": {
                        "identifiers": ['XXX'],
                        "manufacturer": 'foo',
                        "model": '2020 bar',
                        "name": '2020 foo bar',
                        "suggested_area": '2020 foo bar',
                    },
                    "availability": {
                        "topic": 'homeassistant/XXX/available',
                        "payload_available": 'true',
                        "payload_not_available": 'false',
                    },
                    "unique_id": 'xxx_polling_status_message',
                    "name": 'Polling Status Message',
                    "state_topic": pollingStatusTopicState,
                    "value_template": "{{ value_json.error.message }}",
                    "icon": "mdi:message-alert",
                };

                const result = mqtt.createPollingStatusMessageSensorConfigPayload(pollingStatusTopicState, listAllSensorsTogether);

                assert.deepStrictEqual(result.topic, expectedTopic);
                assert.deepStrictEqual(result.payload, expectedPayload);
            });

            it('should generate the correct sensor config payload for polling status message when listAllSensorsTogether is false', () => {
                const pollingStatusTopicState = 'homeassistant/XXX/polling_status/state';
                const listAllSensorsTogether = false;
                const expectedTopic = 'homeassistant/sensor/XXX/polling_status_message/config';
                const expectedPayload = {
                    "device": {
                        "identifiers": ['XXX_Command_Status_Monitor'],
                        "manufacturer": 'foo',
                        "model": '2020 bar',
                        "name": '2020 foo bar Command Status Monitor Sensors',
                        "suggested_area": '2020 foo bar Command Status Monitor Sensors',
                    },
                    "availability": {
                        "topic": 'homeassistant/XXX/available',
                        "payload_available": 'true',
                        "payload_not_available": 'false',
                    },
                    "unique_id": 'xxx_polling_status_message',
                    "name": 'Polling Status Message',
                    "state_topic": pollingStatusTopicState,
                    "value_template": "{{ value_json.error.message }}",
                    "icon": "mdi:message-alert",
                };

                const result = mqtt.createPollingStatusMessageSensorConfigPayload(pollingStatusTopicState, listAllSensorsTogether);

                assert.deepStrictEqual(result.topic, expectedTopic);
                assert.deepStrictEqual(result.payload, expectedPayload);
            });
        });

        describe('createPollingStatusCodeSensorConfigPayload', () => {
            it('should generate the correct config payload for polling status code sensor when listAllSensorsTogether is true', () => {
                const pollingStatusTopicState = 'homeassistant/XXX/polling_status_code/state';
                const listAllSensorsTogether = true;
                const expectedTopic = 'homeassistant/sensor/XXX/polling_status_code/config';
                const expectedPayload = {
                    device: {
                        identifiers: ['XXX'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: '2020 foo bar',
                    },
                    availability: {
                        topic: 'homeassistant/XXX/available',
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_polling_status_code',
                    name: 'Polling Status Code',
                    state_topic: pollingStatusTopicState,
                    value_template: '{{ value_json.error.response.status | int(0) }}',
                    icon: 'mdi:sync-alert',
                };

                const result = mqtt.createPollingStatusCodeSensorConfigPayload(pollingStatusTopicState, listAllSensorsTogether);

                assert.deepStrictEqual(result.topic, expectedTopic);
                assert.deepStrictEqual(result.payload, expectedPayload);
            });

            it('should generate the correct config payload for polling status code sensor when listAllSensorsTogether is false', () => {
                const pollingStatusTopicState = 'homeassistant/XXX/polling_status_code/state';
                const listAllSensorsTogether = false;
                const expectedTopic = 'homeassistant/sensor/XXX/polling_status_code/config';
                const expectedPayload = {
                    device: {
                        identifiers: ['XXX_Command_Status_Monitor'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar Command Status Monitor Sensors',
                        suggested_area: '2020 foo bar Command Status Monitor Sensors',
                    },
                    availability: {
                        topic: 'homeassistant/XXX/available',
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_polling_status_code',
                    name: 'Polling Status Code',
                    state_topic: pollingStatusTopicState,
                    value_template: '{{ value_json.error.response.status | int(0) }}',
                    icon: 'mdi:sync-alert',
                };

                const result = mqtt.createPollingStatusCodeSensorConfigPayload(pollingStatusTopicState, listAllSensorsTogether);

                assert.deepStrictEqual(result.topic, expectedTopic);
                assert.deepStrictEqual(result.payload, expectedPayload);
            });
        });

        describe('createPollingStatusTimestampSensorConfigPayload', () => {
            it('should generate the correct config payload when listAllSensorsTogether is true', () => {
                const pollingStatusTopicState = 'homeassistant/XXX/polling_status_timestamp/state';
                const listAllSensorsTogether = true;
                const expectedTopic = 'homeassistant/sensor/XXX/polling_status_timestamp/config';
                const expectedPayload = {
                    device: {
                        identifiers: ['XXX'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: '2020 foo bar',
                    },
                    availability: {
                        topic: 'homeassistant/XXX/available',
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_polling_status_timestamp',
                    name: 'Polling Status Timestamp',
                    state_topic: pollingStatusTopicState,
                    value_template: '{{ value_json.completionTimestamp }}',
                    device_class: 'timestamp',
                    icon: 'mdi:calendar-clock',
                };

                const result = mqtt.createPollingStatusTimestampSensorConfigPayload(pollingStatusTopicState, listAllSensorsTogether);

                assert.deepStrictEqual(result.topic, expectedTopic);
                assert.deepStrictEqual(result.payload, expectedPayload);
            });

            it('should generate the correct config payload when listAllSensorsTogether is false', () => {
                const pollingStatusTopicState = 'homeassistant/XXX/polling_status_timestamp/state';
                const listAllSensorsTogether = false;
                const expectedTopic = 'homeassistant/sensor/XXX/polling_status_timestamp/config';
                const expectedPayload = {
                    device: {
                        identifiers: ['XXX_Command_Status_Monitor'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar Command Status Monitor Sensors',
                        suggested_area: '2020 foo bar Command Status Monitor Sensors',
                    },
                    availability: {
                        topic: 'homeassistant/XXX/available',
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_polling_status_timestamp',
                    name: 'Polling Status Timestamp',
                    state_topic: pollingStatusTopicState,
                    value_template: '{{ value_json.completionTimestamp }}',
                    device_class: 'timestamp',
                    icon: 'mdi:calendar-clock',
                };

                const result = mqtt.createPollingStatusTimestampSensorConfigPayload(pollingStatusTopicState, listAllSensorsTogether);

                assert.deepStrictEqual(result.topic, expectedTopic);
                assert.deepStrictEqual(result.payload, expectedPayload);
            });
        });

        describe('createPollingRefreshIntervalSensorConfigPayload', () => {
            it('should generate the correct config payload for polling refresh interval sensor when listAllSensorsTogether is true', () => {
                const refreshIntervalCurrentValTopic = 'homeassistant/XXX/polling_refresh_interval/state';
                const listAllSensorsTogether = true;
                const expectedTopic = 'homeassistant/sensor/XXX/polling_refresh_interval/config';
                const expectedPayload = {
                    device: {
                        identifiers: ['XXX'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: '2020 foo bar',
                    },
                    availability: {
                        topic: 'homeassistant/XXX/available',
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_polling_refresh_interval',
                    name: 'Polling Refresh Interval',
                    state_topic: refreshIntervalCurrentValTopic,
                    value_template: '{{ value | int(0) }}',
                    icon: 'mdi:timer-check-outline',
                    unit_of_measurement: 'ms',
                    state_class: 'measurement',
                    device_class: 'duration',
                };

                const result = mqtt.createPollingRefreshIntervalSensorConfigPayload(refreshIntervalCurrentValTopic, listAllSensorsTogether);

                assert.deepStrictEqual(result.topic, expectedTopic);
                assert.deepStrictEqual(result.payload, expectedPayload);
            });

            it('should generate the correct config payload for polling refresh interval sensor when listAllSensorsTogether is false', () => {
                const refreshIntervalCurrentValTopic = 'homeassistant/XXX/polling_refresh_interval/state';
                const listAllSensorsTogether = false;
                const expectedTopic = 'homeassistant/sensor/XXX/polling_refresh_interval/config';
                const expectedPayload = {
                    device: {
                        identifiers: ['XXX_Command_Status_Monitor'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar Command Status Monitor Sensors',
                        suggested_area: '2020 foo bar Command Status Monitor Sensors',
                    },
                    availability: {
                        topic: 'homeassistant/XXX/available',
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_polling_refresh_interval',
                    name: 'Polling Refresh Interval',
                    state_topic: refreshIntervalCurrentValTopic,
                    value_template: '{{ value | int(0) }}',
                    icon: 'mdi:timer-check-outline',
                    unit_of_measurement: 'ms',
                    state_class: 'measurement',
                    device_class: 'duration',
                };

                const result = mqtt.createPollingRefreshIntervalSensorConfigPayload(refreshIntervalCurrentValTopic, listAllSensorsTogether);

                assert.deepStrictEqual(result.topic, expectedTopic);
                assert.deepStrictEqual(result.payload, expectedPayload);
            });
        });

        describe('createPollingStatusTFSensorConfigPayload', () => {
            it('should generate the correct config payload for polling status TF sensor when listAllSensorsTogether is true', () => {
                const pollingStatusTopicState = 'homeassistant/XXX/polling_status_tf/state';
                const listAllSensorsTogether = true;
                const expectedTopic = 'homeassistant/binary_sensor/XXX/polling_status_tf/config';
                const expectedPayload = {
                    device: {
                        identifiers: ['XXX'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: '2020 foo bar',
                    },
                    availability: {
                        topic: 'homeassistant/XXX/available',
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_onstar_polling_status_successful',
                    name: 'Polling Status Successful',
                    state_topic: pollingStatusTopicState,
                    payload_on: "false",
                    payload_off: "true",
                    device_class: "problem",
                    icon: "mdi:sync-alert",
                };

                const result = mqtt.createPollingStatusTFSensorConfigPayload(pollingStatusTopicState, listAllSensorsTogether);

                assert.deepStrictEqual(result.topic, expectedTopic);
                assert.deepStrictEqual(result.payload, expectedPayload);
            });

            it('should generate the correct config payload for polling status TF sensor when listAllSensorsTogether is false', () => {
                const pollingStatusTopicState = 'homeassistant/XXX/polling_status_tf/state';
                const listAllSensorsTogether = false;
                const expectedTopic = 'homeassistant/binary_sensor/XXX/polling_status_tf/config';
                const expectedPayload = {
                    device: {
                        identifiers: ['XXX_Command_Status_Monitor'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar Command Status Monitor Sensors',
                        suggested_area: '2020 foo bar Command Status Monitor Sensors',
                    },
                    availability: {
                        topic: 'homeassistant/XXX/available',
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_onstar_polling_status_successful',
                    name: 'Polling Status Successful',
                    state_topic: pollingStatusTopicState,
                    payload_on: "false",
                    payload_off: "true",
                    device_class: "problem",
                    icon: "mdi:sync-alert",
                };

                const result = mqtt.createPollingStatusTFSensorConfigPayload(pollingStatusTopicState, listAllSensorsTogether);

                assert.deepStrictEqual(result.topic, expectedTopic);
                assert.deepStrictEqual(result.payload, expectedPayload);
            });
        });

        describe('createButtonConfigPayload', () => {
            it('should create button config payload for a given vehicle', () => {
                const vehicle = {
                    make: 'Chevrolet',
                    model: 'Bolt',
                    year: 2022,
                    vin: '1G1FY6S07N4100000',
                    toString: () => `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                };

                const expectedButtonInstances = [];
                const expectedButtonConfigs = [];
                const expectedConfigPayloads = [];

                for (const buttonName in MQTT.CONSTANTS.BUTTONS) {
                    const buttonConfig = `homeassistant/button/XXX/${MQTT.convertName(buttonName)}/config`;
                    const button = {
                        name: buttonName,
                        config: buttonConfig,
                        vehicle: vehicle,
                    };

                    expectedButtonInstances.push(button);

                    let unique_id = `${vehicle.vin}_Command_${button.name}`;
                    unique_id = unique_id.replace(/\s+/g, '-').toLowerCase();

                    expectedConfigPayloads.push({
                        "device": {
                            "identifiers": [vehicle.vin],
                            "manufacturer": vehicle.make,
                            "model": vehicle.year + ' ' + vehicle.model,
                            "name": vehicle.toString(),
                            "suggested_area": vehicle.toString(),
                        },
                        "availability": {
                            "topic": 'homeassistant/XXX/available',
                            "payload_available": 'true',
                            "payload_not_available": 'false',
                        },
                        "unique_id": unique_id,
                        "name": `Command ${button.name}`,
                        "icon": MQTT.CONSTANTS.BUTTONS[button.name].Icon,
                        "command_topic": 'homeassistant/XXX/command',
                        "payload_press": JSON.stringify({ "command": MQTT.CONSTANTS.BUTTONS[button.name].Name }),
                        "qos": 2,
                        "enabled_by_default": false,
                    });

                    expectedButtonConfigs.push(buttonConfig);
                }

                const result = mqtt.createButtonConfigPayload(vehicle);

                assert.deepStrictEqual(result.buttonInstances, expectedButtonInstances);
                assert.deepStrictEqual(result.buttonConfigs, expectedButtonConfigs);
                assert.deepStrictEqual(result.configPayloads, expectedConfigPayloads);
            });
        });

        describe('createButtonConfigPayloadCSMG', () => {
            it('should generate the correct button config payload for a given vehicle', () => {
                const vehicle = {
                    make: 'foo',
                    model: 'bar',
                    year: 2020,
                    vin: '1G1FY6S07N4100000',
                    toString: function () { return `${this.year} ${this.make} ${this.model}`; }
                };

                const result = mqtt.createButtonConfigPayloadCSMG(vehicle);

                // Check the length of the arrays
                assert.strictEqual(result.buttonInstances.length, Object.keys(MQTT.CONSTANTS.BUTTONS).length);
                assert.strictEqual(result.buttonConfigs.length, Object.keys(MQTT.CONSTANTS.BUTTONS).length);
                assert.strictEqual(result.configPayloads.length, Object.keys(MQTT.CONSTANTS.BUTTONS).length);

                // Check the first button instance
                const firstButton = result.buttonInstances[0];
                assert.strictEqual(firstButton.name, Object.keys(MQTT.CONSTANTS.BUTTONS)[0]);
                assert.strictEqual(firstButton.config, `homeassistant/button/XXX/${MQTT.convertName(firstButton.name)}_monitor/config`);
                assert.strictEqual(firstButton.vehicle, vehicle);

                // Check the first config payload
                const firstPayload = result.configPayloads[0];
                assert.strictEqual(firstPayload.device.identifiers[0], `${vehicle.vin}_Command_Status_Monitor`);
                assert.strictEqual(firstPayload.device.manufacturer, vehicle.make);
                assert.strictEqual(firstPayload.device.model, `${vehicle.year} ${vehicle.model}`);
                assert.strictEqual(firstPayload.device.name, `${vehicle.toString()} Command Status Monitor Sensors`);
                assert.strictEqual(firstPayload.device.suggested_area, `${vehicle.toString()} Command Status Monitor Sensors`);
                assert.strictEqual(firstPayload.unique_id, `${vehicle.vin}_Command_${firstButton.name}_Monitor`.replace(/\s+/g, '-').toLowerCase());
                assert.strictEqual(firstPayload.name, `Command ${firstButton.name}`);
                assert.strictEqual(firstPayload.command_topic, mqtt.getCommandTopic());
                assert.strictEqual(firstPayload.payload_press, JSON.stringify({ "command": MQTT.CONSTANTS.BUTTONS[firstButton.name].Name }));
                assert.strictEqual(firstPayload.qos, 2);
                assert.strictEqual(firstPayload.enabled_by_default, false);
            });
        });

        describe('createSensorMessageConfigPayload', () => {
            beforeEach(() => {
                // Set up the MQTT instance and vehicle details
                mqtt.vehicle = {
                    make: 'foo',
                    model: 'bar',
                    year: 2020,
                    vin: 'XXX',
                    toString: function () { return `${this.year} ${this.make} ${this.model}`; }
                };
                mqtt.prefix = 'testPrefix';
                mqtt.instance = 'testInstance';
            });

            it('should create sensor message config payload when component is not provided', () => {
                const sensor = 'testSensor';
                const icon = 'testIcon';
                const expected = {
                    topic: 'testPrefix/sensor/testInstance/testSensor_message/config',
                    payload: {
                        device: {
                            identifiers: ['XXX'],
                            manufacturer: 'foo',
                            model: '2020 bar',
                            name: '2020 foo bar',
                            suggested_area: '2020 foo bar',
                        },
                        availability: {
                            topic: mqtt.getAvailabilityTopic(),
                            payload_available: 'true',
                            payload_not_available: 'false',
                        },
                        unique_id: 'xxx_testSensor_message',
                        name: 'TestSensor Message',
                        state_topic: 'testPrefix/sensor/testInstance/testSensor/state',
                        value_template: '{{ value_json.testSensor_message }}',
                        icon: 'testIcon',
                    }
                };
                const result = mqtt.createSensorMessageConfigPayload(sensor, undefined, icon);
                assert.deepStrictEqual(result, expected);
            });

            it('should create sensor message config payload when component is provided', () => {
                const sensor = 'tire_pressure';
                const component = 'tire_pressure_lf_message';
                const icon = 'testIcon';
                const expected = {
                    topic: 'testPrefix/sensor/testInstance/tire_pressure_lf_message/config',
                    payload: {
                        device: {
                            identifiers: ['XXX'],
                            manufacturer: 'foo',
                            model: '2020 bar',
                            name: '2020 foo bar',
                            suggested_area: '2020 foo bar',
                        },
                        availability: {
                            topic: mqtt.getAvailabilityTopic(),
                            payload_available: 'true',
                            payload_not_available: 'false',
                        },
                        unique_id: 'xxx_tire_pressure_lf_message',
                        name: 'Tire Pressure: Left Front Message',
                        state_topic: 'testPrefix/sensor/testInstance/tire_pressure/state',
                        value_template: '{{ value_json.tire_pressure_lf_message }}',
                        icon: 'testIcon',
                    }
                };
                const result = mqtt.createSensorMessageConfigPayload(sensor, component, icon);
                assert.deepStrictEqual(result, expected);
            });

            it('should create sensor message config payload for EV LOC BASED CHARGING HOME LOC STORED', () => {
                const sensor = 'ev_loc_based_charging_home_loc_stored';
                const component = undefined;
                const icon = 'mdi:home';
                const expected = {
                    topic: 'testPrefix/sensor/testInstance/ev_loc_based_charging_home_loc_stored_message/config',
                    payload: {
                        device: {
                            identifiers: ['XXX'],
                            manufacturer: 'foo',
                            model: '2020 bar',
                            name: '2020 foo bar',
                            suggested_area: '2020 foo bar',
                        },
                        availability: {
                            topic: mqtt.getAvailabilityTopic(),
                            payload_available: 'true',
                            payload_not_available: 'false',
                        },
                        unique_id: 'xxx_ev_loc_based_charging_home_loc_stored_message',
                        name: 'Ev Loc Based Charging Home Loc Stored Message',
                        state_topic: 'testPrefix/sensor/testInstance/ev_loc_based_charging_home_loc_stored/state',
                        value_template: '{{ value_json.ev_loc_based_charging_home_loc_stored_message }}',
                        icon: 'mdi:home',
                    },
                };
                const result = mqtt.createSensorMessageConfigPayload(sensor, component, icon);
                assert.deepStrictEqual(result, expected);
            });

            it('should create sensor message config payload for CABIN PRECONDITIONING REQUEST', () => {
                const sensor = 'cabin_preconditioning_request';
                const component = undefined;
                const icon = 'mdi:car';
                const expected = {
                    topic: 'testPrefix/sensor/testInstance/cabin_preconditioning_request_message/config',
                    payload: {
                        device: {
                            identifiers: ['XXX'],
                            manufacturer: 'foo',
                            model: '2020 bar',
                            name: '2020 foo bar',
                            suggested_area: '2020 foo bar',
                        },
                        availability: {
                            topic: mqtt.getAvailabilityTopic(),
                            payload_available: 'true',
                            payload_not_available: 'false',
                        },
                        unique_id: 'xxx_cabin_preconditioning_request_message',
                        name: 'Cabin Preconditioning Request Message',
                        state_topic: 'testPrefix/sensor/testInstance/cabin_preconditioning_request/state',
                        value_template: '{{ value_json.cabin_preconditioning_request_message }}',
                        icon: 'mdi:car',
                    },
                };
                const result = mqtt.createSensorMessageConfigPayload(sensor, component, icon);
                assert.deepStrictEqual(result, expected);
            });

            it('should create sensor message config payload for WEEKEND_END_TIME', () => {
                const sensor = 'weekend_end_time';
                const component = undefined;
                const icon = 'mdi:calendar-clock';
                const expected = {
                    topic: 'testPrefix/sensor/testInstance/weekend_end_time_message/config',
                    payload: {
                        device: {
                            identifiers: ['XXX'],
                            manufacturer: 'foo',
                            model: '2020 bar',
                            name: '2020 foo bar',
                            suggested_area: '2020 foo bar',
                        },
                        availability: {
                            topic: mqtt.getAvailabilityTopic(),
                            payload_available: 'true',
                            payload_not_available: 'false',
                        },
                        unique_id: 'xxx_weekend_end_time_message',
                        name: 'Weekend End Time Message',
                        state_topic: 'testPrefix/sensor/testInstance/weekend_end_time/state',
                        value_template: '{{ value_json.weekend_end_time_message }}',
                        icon: 'mdi:calendar-clock',
                    },
                };
                const result = mqtt.createSensorMessageConfigPayload(sensor, component, icon);
                assert.deepStrictEqual(result, expected);
            });

        });

        it('should create sensor message config payload for Right Front tire', () => {
            const sensor = 'tire_pressure';
            const component = 'tire_pressure_rf_message';
            const icon = 'testIcon';
            const expected = {
                topic: 'homeassistant/sensor/XXX/tire_pressure_rf_message/config',
                payload: {
                    device: {
                        identifiers: ['XXX'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: '2020 foo bar',
                    },
                    availability: {
                        topic: mqtt.getAvailabilityTopic(),
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_tire_pressure_rf_message',
                    name: 'Tire Pressure: Right Front Message',
                    state_topic: 'homeassistant/sensor/XXX/tire_pressure/state',
                    value_template: '{{ value_json.tire_pressure_rf_message }}',
                    icon: 'testIcon',
                }
            };
            const result = mqtt.createSensorMessageConfigPayload(sensor, component, icon);
            assert.deepStrictEqual(result, expected);
        });

        it('should create sensor message config payload for Left Rear tire', () => {
            const sensor = 'tire_pressure';
            const component = 'tire_pressure_lr_message';
            const icon = 'testIcon';
            const expected = {
                topic: 'homeassistant/sensor/XXX/tire_pressure_lr_message/config',
                payload: {
                    device: {
                        identifiers: ['XXX'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: '2020 foo bar',
                    },
                    availability: {
                        topic: mqtt.getAvailabilityTopic(),
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_tire_pressure_lr_message',
                    name: 'Tire Pressure: Left Rear Message',
                    state_topic: 'homeassistant/sensor/XXX/tire_pressure/state',
                    value_template: '{{ value_json.tire_pressure_lr_message }}',
                    icon: 'testIcon',
                }
            };
            const result = mqtt.createSensorMessageConfigPayload(sensor, component, icon);
            assert.deepStrictEqual(result, expected);
        });

        it('should create sensor message config payload for Right Rear tire', () => {
            const sensor = 'tire_pressure';
            const component = 'tire_pressure_rr_message';
            const icon = 'testIcon';
            const expected = {
                topic: 'homeassistant/sensor/XXX/tire_pressure_rr_message/config',
                payload: {
                    device: {
                        identifiers: ['XXX'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: '2020 foo bar',
                    },
                    availability: {
                        topic: mqtt.getAvailabilityTopic(),
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_tire_pressure_rr_message',
                    name: 'Tire Pressure: Right Rear Message',
                    state_topic: 'homeassistant/sensor/XXX/tire_pressure/state',
                    value_template: '{{ value_json.tire_pressure_rr_message }}',
                    icon: 'testIcon',
                }
            };
            const result = mqtt.createSensorMessageConfigPayload(sensor, component, icon);
            assert.deepStrictEqual(result, expected);
        });
    });

    describe('additional tests for uncovered lines', () => {
        it('should handle undefined vehicle in getAvailabilityTopic', () => {
            mqtt.vehicle = undefined;
            mqtt.instance = undefined; // Ensure instance is also undefined
            assert.strictEqual(mqtt.getAvailabilityTopic(), 'homeassistant/undefined/available');
        });

        it('should handle undefined vehicle in getCommandTopic', () => {
            mqtt.vehicle = undefined;
            mqtt.instance = undefined; // Ensure instance is also undefined
            assert.strictEqual(mqtt.getCommandTopic(), 'homeassistant/undefined/command');
        });

        it('should handle undefined diagnostic elements in getConfigPayload', () => {
            const d = new Diagnostic({});
            const diagnosticElement = { name: undefined }; // Mock diagnostic element
            const expectedPayload = {
                availability_topic: 'homeassistant/XXX/available',
                device: {
                    identifiers: ['XXX'],
                    manufacturer: 'foo',
                    model: '2020 bar',
                    name: '2020 foo bar',
                    suggested_area: '2020 foo bar Sensors',
                },
                state_class: 'measurement',
                device_class: undefined,
                icon: undefined,
                name: '',
                state_topic: 'homeassistant/sensor/XXX//state',
                unique_id: 'xxx-undefined',
                value_template: '{{ value_json. }}',
                json_attributes_topic: 'homeassistant/sensor/XXX//state',
                json_attributes_template: "{{ {'last_updated': value_json._last_updated} | tojson }}",
                unit_of_measurement: undefined,
                payload_available: 'true',
                payload_not_available: 'false',
            };
            assert.deepStrictEqual(mqtt.getConfigPayload(d, diagnosticElement), expectedPayload);
        });

        it('should handle edge cases in createSensorMessageConfigPayload', () => {
            const sensor = 'testSensor';
            const component = undefined;
            const icon = undefined;
            const expected = {
                topic: 'homeassistant/sensor/XXX/testSensor_message/config',
                payload: {
                    device: {
                        identifiers: ['XXX'],
                        manufacturer: 'foo',
                        model: '2020 bar',
                        name: '2020 foo bar',
                        suggested_area: '2020 foo bar',
                    },
                    availability: {
                        topic: mqtt.getAvailabilityTopic(),
                        payload_available: 'true',
                        payload_not_available: 'false',
                    },
                    unique_id: 'xxx_testSensor_message',
                    name: 'TestSensor Message',
                    state_topic: 'homeassistant/sensor/XXX/testSensor/state',
                    value_template: '{{ value_json.testSensor_message }}',
                    icon: undefined,
                },
            };
            const result = mqtt.createSensorMessageConfigPayload(sensor, component, icon);
            assert.deepStrictEqual(result, expected);
        });

        it('should handle invalid sensor type in determineSensorType', () => {
            assert.strictEqual(MQTT.determineSensorType('INVALID_SENSOR'), 'sensor');
        });

        it('should handle undefined diagnostic elements in getStatePayload', () => {
            const d = new Diagnostic({});
            assert.deepStrictEqual(mqtt.getStatePayload(d), {});
        });

        it('should handle edge cases in addNamePrefix', () => {
            mqtt.namePrefix = '';
            const name = 'TestName';
            assert.strictEqual(mqtt.addNamePrefix(name), 'TestName');
        });

        it('should handle undefined name in addNamePrefix', () => {
            mqtt.namePrefix = 'Prefix';
            assert.strictEqual(mqtt.addNamePrefix(undefined), 'Prefix undefined');
        });
    });

    describe('MQTT message handling', () => {
        it('should handle empty state payload', () => {
            const d = new Diagnostic({});
            assert.deepStrictEqual(mqtt.getStatePayload(d), {});
        });

        it('should handle invalid MQTT topic conversion', () => {
            assert.strictEqual(MQTT.convertName(''), '');
            assert.strictEqual(MQTT.convertName(null), '');
            assert.strictEqual(MQTT.convertName(undefined), '');
        });

        it('should handle getStatePayload edge cases', () => {
            const diagnostic = new Diagnostic({
                name: 'TEST',
                diagnosticElements: [
                    { name: 'UNKNOWN_BOOL', value: 'INVALID', unit: null },
                    { name: 'UNKNOWN_NUM', value: 'NOT_A_NUMBER', unit: 'units' }
                ]
            });
            const result = mqtt.getStatePayload(diagnostic);
            assert.strictEqual(result.unknown_bool_message, undefined);
            // Unknown values are passed through as-is when they can't be converted to numbers
            assert.strictEqual(result.unknown_bool, 'INVALID');
        });

        describe('getStatePayload binary sensor value handling', () => {
            let diagnostic;

            beforeEach(() => {
                diagnostic = new Diagnostic({ name: 'TEST' });
            });

            it('should handle EV PLUG STATE correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'EV PLUG STATE', value: 'plugged', message: 'plugged', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.ev_plug_state, true);
                assert.strictEqual(result.ev_plug_state_message, 'plugged');

                diagnostic.diagnosticElements = [
                    { name: 'EV PLUG STATE', value: 'unplugged', message: 'unplugged', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.ev_plug_state, false);
            });

            it('should handle EV CHARGE STATE correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'EV CHARGE STATE', value: 'charging', message: 'charging', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.ev_charge_state, true);

                diagnostic.diagnosticElements = [
                    { name: 'EV CHARGE STATE', value: 'not_charging', message: 'not_charging', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.ev_charge_state, false);
            });

            it('should handle PRIORITY CHARGE INDICATOR correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'PRIORITY CHARGE INDICATOR', value: 'TRUE', message: 'na', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.priority_charge_indicator, true);

                diagnostic.diagnosticElements = [
                    { name: 'PRIORITY CHARGE INDICATOR', value: 'FALSE', message: 'na', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.priority_charge_indicator, false);
            });

            it('should handle PRIORITY CHARGE STATUS correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'PRIORITY CHARGE STATUS', value: 'ACTIVE', message: 'na', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.priority_charge_status, true);

                diagnostic.diagnosticElements = [
                    { name: 'PRIORITY CHARGE STATUS', value: 'NOT_ACTIVE', message: 'na', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.priority_charge_status, false);
            });

            it('should handle LOC BASED CHARGING HOME LOC STORED correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'LOC BASED CHARGING HOME LOC STORED', value: 'TRUE', message: 'na', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.loc_based_charging_home_loc_stored, true);

                diagnostic.diagnosticElements = [
                    { name: 'LOC BASED CHARGING HOME LOC STORED', value: 'FALSE', message: 'na', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.loc_based_charging_home_loc_stored, false);
            });

            it('should handle SCHEDULED CABIN PRECONDTION CUSTOM SET REQ ACTIVE correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'SCHEDULED CABIN PRECONDTION CUSTOM SET REQ ACTIVE', value: 'TRUE', message: 'na', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.scheduled_cabin_precondtion_custom_set_req_active, true);

                diagnostic.diagnosticElements = [
                    { name: 'SCHEDULED CABIN PRECONDTION CUSTOM SET REQ ACTIVE', value: 'FALSE', message: 'na', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.scheduled_cabin_precondtion_custom_set_req_active, false);
            });

            it('should handle VEH IN HOME LOCATION correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'VEH IN HOME LOCATION', value: 'TRUE', message: 'na', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.veh_in_home_location, true);

                diagnostic.diagnosticElements = [
                    { name: 'VEH IN HOME LOCATION', value: 'FALSE', message: 'na', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.veh_in_home_location, false);
            });

            it('should handle VEH NOT IN HOME LOC correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'VEH NOT IN HOME LOC', value: 'TRUE', message: 'na', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.veh_not_in_home_loc, true);

                diagnostic.diagnosticElements = [
                    { name: 'VEH NOT IN HOME LOC', value: 'FALSE', message: 'na', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.veh_not_in_home_loc, false);
            });

            it('should handle VEH LOCATION STATUS INVALID correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'VEH LOCATION STATUS INVALID', value: 'TRUE', message: 'na', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.veh_location_status_invalid, true);

                diagnostic.diagnosticElements = [
                    { name: 'VEH LOCATION STATUS INVALID', value: 'FALSE', message: 'na', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.veh_location_status_invalid, false);
            });

            it('should handle CABIN PRECOND REQUEST correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'CABIN PRECOND REQUEST', value: 'ON', message: 'on', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.cabin_precond_request, true);

                diagnostic.diagnosticElements = [
                    { name: 'CABIN PRECOND REQUEST', value: 'OFF', message: 'off', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.cabin_precond_request, false);
            });

            it('should handle PREF CHARGING TIMES SETTING correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'PREF CHARGING TIMES SETTING', value: 'ON', message: 'on', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.pref_charging_times_setting, true);

                diagnostic.diagnosticElements = [
                    { name: 'PREF CHARGING TIMES SETTING', value: 'OFF', message: 'off', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.pref_charging_times_setting, false);
            });

            it('should handle LOCATION BASE CHARGE SETTING correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'LOCATION BASE CHARGE SETTING', value: 'ON', message: 'on', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.location_base_charge_setting, true);

                diagnostic.diagnosticElements = [
                    { name: 'LOCATION BASE CHARGE SETTING', value: 'OFF', message: 'off', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.location_base_charge_setting, false);
            });

            it('should handle CABIN PRECONDITIONING REQUEST correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'CABIN PRECONDITIONING REQUEST', value: 'ACTION', message: 'action', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.cabin_preconditioning_request, true);

                diagnostic.diagnosticElements = [
                    { name: 'CABIN PRECONDITIONING REQUEST', value: 'NO_ACTION', message: 'no_action', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.cabin_preconditioning_request, false);
            });

            it('should handle HIGH VOLTAGE BATTERY PRECONDITIONING STATUS correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'HIGH VOLTAGE BATTERY PRECONDITIONING STATUS', value: 'ENABLED', message: 'enabled', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.high_voltage_battery_preconditioning_status, true);

                diagnostic.diagnosticElements = [
                    { name: 'HIGH VOLTAGE BATTERY PRECONDITIONING STATUS', value: 'DISABLED', message: 'disabled', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.high_voltage_battery_preconditioning_status, false);
            });

            it('should handle EXHST PART FLTR WARN ON correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'EXHST PART FLTR WARN ON', value: 'TRUE', message: 'na', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.exhst_part_fltr_warn_on, true);

                diagnostic.diagnosticElements = [
                    { name: 'EXHST PART FLTR WARN ON', value: 'FALSE', message: 'na', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.exhst_part_fltr_warn_on, false);
            });

            it('should handle EXHST PART FLTR WARN2 ON correctly', () => {
                diagnostic.diagnosticElements = [
                    { name: 'EXHST PART FLTR WARN2 ON', value: 'TRUE', message: 'na', unit: null }
                ];
                const result = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result.exhst_part_fltr_warn2_on, true);

                diagnostic.diagnosticElements = [
                    { name: 'EXHST PART FLTR WARN2 ON', value: 'FALSE', message: 'na', unit: null }
                ];
                const result2 = mqtt.getStatePayload(diagnostic);
                assert.strictEqual(result2.exhst_part_fltr_warn2_on, false);
            });
        });


    });

    describe('mapping functions', () => {
        let mqtt;
        let d;
        let vehicle = new Vehicle({ make: 'foo', model: 'bar', vin: 'XXX', year: 2020 });

        beforeEach(() => {
            mqtt = new MQTT(vehicle);
            d = new Diagnostic({});
        });

        it('should map sensor config payload for additional device classes', () => {
            const diagEl = {
                name: 'INTERM VOLT BATT VOLT',
                value: '12.5',
                unit: 'V'
            };
            const result = mqtt.getConfigMapping(d, diagEl);
            assert.strictEqual(result.device_class, 'voltage');
            assert.strictEqual(result.state_class, 'measurement');
        });

        it('should map sensor config payload for PROJECTED EV RANGE GENERAL AWAY TARGET CHARGE SET', () => {
            const diagEl = {
                name: 'PROJECTED EV RANGE GENERAL AWAY TARGET CHARGE SET',
                value: '597.984',
                unit: 'km'
            };
            const result = mqtt.getConfigMapping(d, diagEl);
            assert.strictEqual(result.device_class, 'distance');
            assert.strictEqual(result.state_class, 'measurement');
            assert.ok(result.value_template.includes('projected_ev_range_general_away_target_charge_set'));
            assert.strictEqual(result.unit_of_measurement, 'km');
        });

        it('should map sensor config payload for PROJECTED EV RANGE GENERAL AWAY TARGET CHARGE SET MI', () => {
            const diagEl = {
                name: 'PROJECTED EV RANGE GENERAL AWAY TARGET CHARGE SET MI',
                value: '371.6',
                unit: 'mi'
            };
            const result = mqtt.getConfigMapping(d, diagEl);
            assert.strictEqual(result.device_class, 'distance');
            assert.strictEqual(result.state_class, 'measurement');
            assert.ok(result.value_template.includes('projected_ev_range_general_away_target_charge_set_mi'));
            assert.strictEqual(result.unit_of_measurement, 'mi');
        });

        it('should map sensor config payload for charger power level', () => {
            const diagEl = {
                name: 'CHARGER POWER LEVEL',
                value: 'REDUCED',
                unit: null
            };
            const result = mqtt.getConfigMapping(d, diagEl);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
        });

        it('should map sensor config payload for weekend start time', () => {
            const diagEl = {
                name: 'WEEKEND START TIME',
                value: '08:00',
                unit: null
            };
            const result = mqtt.getConfigMapping(d, diagEl);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
        });

        it('should map sensor config payload for electric related measurements', () => {
            const diagEl = {
                name: 'LIFETIME ENERGY USED',
                value: '500.5',
                unit: 'kWh'
            };
            const result = mqtt.getConfigMapping(d, diagEl);
            assert.strictEqual(result.device_class, 'energy');
            assert.strictEqual(result.state_class, 'total_increasing');
        });

        it('should map sensor config payload for battery temperature', () => {
            const diagEl = {
                name: 'HYBRID BATTERY MINIMUM TEMPERATURE',
                value: '25.5',
                unit: '°C'
            };
            const result = mqtt.getConfigMapping(d, diagEl);
            assert.strictEqual(result.device_class, 'temperature');
            assert.strictEqual(result.state_class, 'measurement');
        });

        it('should map sensor config payload for EV battery level', () => {
            const diagEl = {
                name: 'EV BATTERY LEVEL',
                value: '80',
                unit: '%'
            };
            const result = mqtt.getConfigMapping(d, diagEl);
            assert.strictEqual(result.device_class, 'battery');
            assert.strictEqual(result.state_class, 'measurement');
        });

        it('should handle missing values in mapBaseConfigPayload', () => {
            const diagEl = {
                name: 'TEST_SENSOR',
                value: null,
                unit: null
            };
            const result = mqtt.mapBaseConfigPayload(d, diagEl);
            assert.ok(result.unique_id.includes('test_sensor'));
            assert.ok(result.value_template.includes('test_sensor'));
        });

        it('should handle null state class in mapSensorConfigPayload', () => {
            const diagEl = {
                name: 'TEST_SENSOR',
                value: '123',
                unit: 'units'
            };
            const result = mqtt.mapSensorConfigPayload(d, diagEl, null);
            assert.strictEqual(result.state_class, null);
            assert.strictEqual(result.unit_of_measurement, 'units');
        });

        it('should map sensor config payload for last trip electric economy', () => {
            const diagEl = {
                name: 'LAST TRIP ELECTRIC ECON',
                value: '3.5',
                unit: 'kWh/100km'
            };
            const result = mqtt.getConfigMapping(d, diagEl);
            assert.strictEqual(result.state_class, 'measurement');
        });

        it('should handle unknown diagnostic element names', () => {
            const diagEl = {
                name: 'UNKNOWN_SENSOR',
                value: '123',
                unit: 'units'
            };
            const result = mqtt.getConfigMapping(d, diagEl);
            assert.strictEqual(result.state_class, 'measurement');
            assert.strictEqual(result.device_class, undefined);
        });

        it('should handle "NA" unit values by converting them to undefined', () => {
            const diagEl = {
                name: 'EXHST FL LEVL WARN STATUS',
                value: 'Green',
                unit: 'NA'
            };
            const result = mqtt.mapSensorConfigPayload(d, diagEl, 'measurement');
            assert.strictEqual(result.unit_of_measurement, undefined);
            assert.strictEqual(result.state_class, 'measurement');
        });

        it('should handle lowercase "na" unit values by converting them to undefined', () => {
            const diagEl = {
                name: 'TEST_SENSOR',
                value: 'Red',
                unit: 'na'
            };
            const result = mqtt.mapSensorConfigPayload(d, diagEl, 'measurement');
            assert.strictEqual(result.unit_of_measurement, undefined);
            assert.strictEqual(result.state_class, 'measurement');
        });

        it('should handle lowercase "nA" unit values by converting them to undefined', () => {
            const diagEl = {
                name: 'TEST_SENSOR',
                value: 'Yellow',
                unit: 'nA'
            };
            const result = mqtt.mapSensorConfigPayload(d, diagEl, 'measurement');
            assert.strictEqual(result.unit_of_measurement, undefined);
            assert.strictEqual(result.state_class, 'measurement');
        });

        it('should handle lowercase "Na" unit values by converting them to undefined', () => {
            const diagEl = {
                name: 'TEST_SENSOR',
                value: 'Orange',
                unit: 'Na'
            };
            const result = mqtt.mapSensorConfigPayload(d, diagEl, 'measurement');
            assert.strictEqual(result.unit_of_measurement, undefined);
            assert.strictEqual(result.state_class, 'measurement');
        });

        it('should preserve valid unit values in mapSensorConfigPayload', () => {
            const diagEl = {
                name: 'TEST_SENSOR',
                value: '123',
                unit: 'kPa'
            };
            const result = mqtt.mapSensorConfigPayload(d, diagEl, 'measurement');
            assert.strictEqual(result.unit_of_measurement, 'kPa');
            assert.strictEqual(result.state_class, 'measurement');
        });

        it('should handle XXX unit values by converting them to undefined', () => {
            const d = new Diagnostic({});
            const diagEl = {
                name: 'TEST_SENSOR',
                value: '123',
                unit: 'XXX'
            };
            const result = mqtt.mapSensorConfigPayload(d, diagEl, 'measurement');
            assert.strictEqual(result.unit_of_measurement, undefined);
            assert.strictEqual(result.state_class, 'measurement');
        });
    });

    describe('constructor initialization', () => {
        it('should initialize with defaults and namePrefix', () => {
            const testVehicle = new Vehicle({ make: 'foo', model: 'bar', vin: 'XXX', year: 2020 });
            const testPrefix = 'testPrefix';
            const testNamePrefix = 'testName';
            const mqtt = new MQTT(testVehicle, testPrefix, testNamePrefix);

            assert.strictEqual(mqtt.prefix, testPrefix);
            assert.strictEqual(mqtt.vehicle, testVehicle);
            assert.strictEqual(mqtt.instance, testVehicle.vin);
            assert.strictEqual(mqtt.namePrefix, testNamePrefix);
        });
    });

    describe('configuration mapping', () => {
        let mqtt;
        let vehicle;

        beforeEach(() => {
            vehicle = new Vehicle({ make: 'foo', model: 'bar', vin: 'XXX', year: 2020 });
            mqtt = new MQTT(vehicle);
        });

        it('should correctly map weekday start time configurations', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'WEEKDAY START TIME',
                value: '08:00',
                unit: null
            };

            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('weekday_start_time'));
        });

        it('should correctly map weekday end time configurations', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'WEEKDAY END TIME',
                value: '17:00',
                unit: null
            };

            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('weekday_end_time'));
        });

        it('should correctly map economy measurements', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'LIFETIME MPGE',
                value: '95.8',
                unit: 'MPGe'
            };

            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, 'measurement');
        });

        it('should map weekend end time correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'WEEKEND END TIME',
                value: '08:00',
                unit: null
            };

            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('weekend_end_time'));
        });

        it('should map weekend start time correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'WEEKEND START TIME',
                value: '08:00',
                unit: null
            };

            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('weekend_start_time'));
        });

        it('should map charge day of week correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'CHARGE DAY OF WEEK',
                value: 'Monday',
                unit: null
            };

            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('charge_day_of_week'));
        });

        it('should map priority charge indicator correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'PRIORITY CHARGE INDICATOR',
                value: 'TRUE',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('priority_charge_indicator'));
        });

        it('should map priority charge status correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'PRIORITY CHARGE STATUS',
                value: 'ACTIVE',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('priority_charge_status'));
        });

        it('should map location based charging home location stored correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'LOC BASED CHARGING HOME LOC STORED',
                value: 'TRUE',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('loc_based_charging_home_loc_stored'));
        });

        it('should map scheduled cabin precondtion custom set request active correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'SCHEDULED CABIN PRECONDTION CUSTOM SET REQ ACTIVE',
                value: 'TRUE',
                unit: null
            };
            const result = mqtt.mapBinarySensorConfigPayload(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('scheduled_cabin_precondtion_custom_set_req_active'));
            assert.strictEqual(result.payload_on, true);
            assert.strictEqual(result.payload_off, false);
        });

        it('should map vehicle in home location correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'VEH IN HOME LOCATION',
                value: 'TRUE',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('veh_in_home_location'));
        });

        it('should map vehicle not in home location correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'VEH NOT IN HOME LOC',
                value: 'TRUE',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('veh_not_in_home_loc'));
        });

        it('should map vehicle location status invalid correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'VEH LOCATION STATUS INVALID',
                value: 'TRUE',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('veh_location_status_invalid'));
        });

        it('should map cabin precond request correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'CABIN PRECOND REQUEST',
                value: 'ON',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('cabin_precond_request'));
        });

        it('should map preferred charging times setting correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'PREF CHARGING TIMES SETTING',
                value: 'ON',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('pref_charging_times_setting'));
        });

        it('should map location base charge setting correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'LOCATION BASE CHARGE SETTING',
                value: 'ON',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('location_base_charge_setting'));
        });

        it('should map cabin preconditioning request correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'CABIN PRECONDITIONING REQUEST',
                value: 'ACTION',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('cabin_preconditioning_request'));
        });

        it('should map high voltage battery preconditioning status correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'HIGH VOLTAGE BATTERY PRECONDITIONING STATUS',
                value: 'ENABLED',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
            assert.ok(result.value_template.includes('high_voltage_battery_preconditioning_status'));
        });

        it('should map binary sensor config for edge cases', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'EXHST PART FLTR WARN ON',
                value: 'TRUE',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
        });

        it('should map EXHST PART FLTR WARN2 ON correctly', () => {
            const diagnostic = new Diagnostic({});
            const element = {
                name: 'EXHST PART FLTR WARN2 ON',
                value: 'TRUE',
                unit: null
            };
            const result = mqtt.getConfigMapping(diagnostic, element);
            assert.strictEqual(result.state_class, undefined);
            assert.strictEqual(result.device_class, undefined);
        });
    });

    describe('base configuration payload', () => {
        let mqtt;
        let diagnostic;
        let vehicle;

        beforeEach(() => {
            vehicle = new Vehicle({ make: 'foo', model: 'bar', vin: 'XXX', year: 2020 });
            mqtt = new MQTT(vehicle);
            diagnostic = new Diagnostic({});
        });

        it('should create base payload with default values', () => {
            const element = {
                name: 'TEST SENSOR',
                value: '123',
                unit: 'units'
            };

            const result = mqtt.mapBaseConfigPayload(diagnostic, element);
            assert.ok(result.unique_id);
            assert.ok(result.state_topic);
            assert.ok(result.value_template);
            assert.deepStrictEqual(result.device, {
                identifiers: ['XXX'],
                manufacturer: 'foo',
                model: '2020 bar',
                name: '2020 foo bar',
                suggested_area: '2020 foo bar Sensors'
            });
        });

        it('should handle null diagnostic elements in base payload', () => {
            const element = {
                name: undefined,
                value: null,
                unit: null
            };

            const result = mqtt.mapBaseConfigPayload(diagnostic, element);
            assert.ok(result.unique_id.includes('undefined'));
            assert.strictEqual(result.value_template, '{{ value_json. }}');
        });
    });

    describe('sensor message configuration payload', () => {
        let mqtt;
        let vehicle;

        beforeEach(() => {
            vehicle = new Vehicle({ make: 'foo', model: 'bar', vin: 'XXX', year: 2020 });
            mqtt = new MQTT(vehicle);
        });

        it('should handle undefined component in sensor message config', () => {
            const result = mqtt.createSensorMessageConfigPayload('test_sensor', undefined, 'icon');
            assert.ok(result.topic.includes('test_sensor_message'));
            assert.ok(result.payload.unique_id.includes('test_sensor_message'));
        });

        it('should handle missing icon in sensor message config', () => {
            const result = mqtt.createSensorMessageConfigPayload('test_sensor', 'component', undefined);
            assert.strictEqual(result.payload.icon, undefined);
        });
    });

    describe('additional sensor mappings for coverage', () => {
        it('should map LEFT_FRONT_TIRE_PRESSURE_STATUS correctly', () => {
            const diagResponse = {
                name: 'LEFT_FRONT_TIRE_PRESSURE_STATUS',
                diagnosticElements: [{ name: 'LEFT_FRONT_TIRE_PRESSURE_STATUS', value: 'TPM_STATUS_NOMINAL', uom: null }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:car-tire-alert');
        });

        it('should map LEFT_REAR_TIRE_PRESSURE_STATUS correctly', () => {
            const diagResponse = {
                name: 'LEFT_REAR_TIRE_PRESSURE_STATUS',
                diagnosticElements: [{ name: 'LEFT_REAR_TIRE_PRESSURE_STATUS', value: 'TPM_STATUS_NOMINAL', uom: null }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:car-tire-alert');
        });

        it('should map RIGHT_FRONT_TIRE_PRESSURE_STATUS correctly', () => {
            const diagResponse = {
                name: 'RIGHT_FRONT_TIRE_PRESSURE_STATUS',
                diagnosticElements: [{ name: 'RIGHT_FRONT_TIRE_PRESSURE_STATUS', value: 'TPM_STATUS_NOMINAL', uom: null }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:car-tire-alert');
        });

        it('should map RIGHT_REAR_TIRE_PRESSURE_STATUS correctly', () => {
            const diagResponse = {
                name: 'RIGHT_REAR_TIRE_PRESSURE_STATUS',
                diagnosticElements: [{ name: 'RIGHT_REAR_TIRE_PRESSURE_STATUS', value: 'TPM_STATUS_NOMINAL', uom: null }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:car-tire-alert');
        });

        it('should map LEFT_FRONT_TIRE_PRESSURE_VALID correctly', () => {
            const diagResponse = {
                name: 'LEFT_FRONT_TIRE_PRESSURE_VALID',
                diagnosticElements: [{ name: 'LEFT_FRONT_TIRE_PRESSURE_VALID', value: '1', uom: null }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:check-circle');
        });

        it('should map LEFT_REAR_TIRE_PRESSURE_VALID correctly', () => {
            const diagResponse = {
                name: 'LEFT_REAR_TIRE_PRESSURE_VALID',
                diagnosticElements: [{ name: 'LEFT_REAR_TIRE_PRESSURE_VALID', value: '1', uom: null }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:check-circle');
        });

        it('should map RIGHT_FRONT_TIRE_PRESSURE_VALID correctly', () => {
            const diagResponse = {
                name: 'RIGHT_FRONT_TIRE_PRESSURE_VALID',
                diagnosticElements: [{ name: 'RIGHT_FRONT_TIRE_PRESSURE_VALID', value: '1', uom: null }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:check-circle');
        });

        it('should map RIGHT_REAR_TIRE_PRESSURE_VALID correctly', () => {
            const diagResponse = {
                name: 'RIGHT_REAR_TIRE_PRESSURE_VALID',
                diagnosticElements: [{ name: 'RIGHT_REAR_TIRE_PRESSURE_VALID', value: '1', uom: null }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:check-circle');
        });

        it('should map GAS RANGE correctly', () => {
            const diagResponse = {
                name: 'GAS RANGE',
                diagnosticElements: [{ name: 'GAS RANGE', value: '450', uom: 'km' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:gas-station');
            assert.strictEqual(config.state_class, 'measurement');
            assert.strictEqual(config.device_class, 'distance');
        });

        it('should map LAST TRIP TOTAL DISTANCE correctly', () => {
            const diagResponse = {
                name: 'LAST TRIP TOTAL DISTANCE',
                diagnosticElements: [{ name: 'LAST TRIP TOTAL DISTANCE', value: '25', uom: 'km' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:map-marker-distance');
            assert.strictEqual(config.state_class, 'measurement');
            assert.strictEqual(config.device_class, 'distance');
        });

        it('should map FUEL CAPACITY correctly', () => {
            const diagResponse = {
                name: 'FUEL CAPACITY',
                diagnosticElements: [{ name: 'FUEL CAPACITY', value: '60', uom: 'L' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:gas-station');
            assert.strictEqual(config.device_class, 'volume_storage');
        });

        it('should map AVERAGE FUEL ECONOMY correctly', () => {
            const diagResponse = {
                name: 'AVERAGE FUEL ECONOMY',
                diagnosticElements: [{ name: 'AVERAGE FUEL ECONOMY', value: '7.5', uom: 'km/L' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:gauge');
            assert.strictEqual(config.state_class, 'measurement');
        });

        it('should map ENGINE RPM correctly', () => {
            const diagResponse = {
                name: 'ENGINE RPM',
                diagnosticElements: [{ name: 'ENGINE RPM', value: '2500', uom: 'rpm' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:engine');
            assert.strictEqual(config.state_class, 'measurement');
        });

        it('should map TIRE PRESSURE PLACARD FRONT correctly', () => {
            const diagResponse = {
                name: 'TIRE PRESSURE PLACARD FRONT',
                diagnosticElements: [{ name: 'TIRE PRESSURE PLACARD FRONT', value: '240', uom: 'kPa' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:card-text');
            assert.strictEqual(config.state_class, 'measurement');
        });

        it('should map TIRE PRESSURE PLACARD REAR correctly', () => {
            const diagResponse = {
                name: 'TIRE PRESSURE PLACARD REAR',
                diagnosticElements: [{ name: 'TIRE PRESSURE PLACARD REAR', value: '240', uom: 'kPa' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:card-text');
            assert.strictEqual(config.state_class, 'measurement');
        });

        it('should map TIRE PRESSURE PLACARD FRONT PSI correctly', () => {
            const diagResponse = {
                name: 'TIRE PRESSURE PLACARD FRONT PSI',
                diagnosticElements: [{ name: 'TIRE PRESSURE PLACARD FRONT PSI', value: '35', uom: 'psi' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:card-text');
            assert.strictEqual(config.state_class, 'measurement');
        });

        it('should map TIRE PRESSURE PLACARD REAR PSI correctly', () => {
            const diagResponse = {
                name: 'TIRE PRESSURE PLACARD REAR PSI',
                diagnosticElements: [{ name: 'TIRE PRESSURE PLACARD REAR PSI', value: '35', uom: 'psi' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:card-text');
            assert.strictEqual(config.state_class, 'measurement');
        });

        it('should map FUEL RANGE MI correctly', () => {
            const diagResponse = {
                name: 'FUEL RANGE MI',
                diagnosticElements: [{ name: 'FUEL RANGE MI', value: '250', uom: 'mi' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:gas-station');
            assert.strictEqual(config.state_class, 'measurement');
            assert.strictEqual(config.device_class, 'distance');
        });

        it('should map FUEL REMAINING GAL correctly', () => {
            const diagResponse = {
                name: 'FUEL REMAINING GAL',
                diagnosticElements: [{ name: 'FUEL REMAINING GAL', value: '10', uom: 'gal' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:gas-station');
            assert.strictEqual(config.state_class, 'measurement');
            assert.strictEqual(config.device_class, 'volume');
        });

        it('should map FUEL USED GAL correctly', () => {
            const diagResponse = {
                name: 'FUEL USED GAL',
                diagnosticElements: [{ name: 'FUEL USED GAL', value: '5', uom: 'gal' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:gas-station');
            assert.strictEqual(config.state_class, 'measurement');
            assert.strictEqual(config.device_class, 'volume');
        });

        it('should map BATT SAVER MODE COUNTER correctly', () => {
            const diagResponse = {
                name: 'BATT SAVER MODE COUNTER',
                diagnosticElements: [{ name: 'BATT SAVER MODE COUNTER', value: '0', uom: null }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:battery-arrow-down');
            assert.strictEqual(config.state_class, 'measurement');
            assert.strictEqual(config.json_attributes_template, "{{ {'status': value_json.batt_saver_mode_counter_status, 'status_color': value_json.batt_saver_mode_counter_status_color, 'last_updated': value_json.batt_saver_mode_counter_last_updated} | tojson }}");
        });

        it('should map BATT SAVER MODE SEV LVL correctly', () => {
            const diagResponse = {
                name: 'BATT SAVER MODE SEV LVL',
                diagnosticElements: [{ name: 'BATT SAVER MODE SEV LVL', value: '0', uom: null }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:battery-arrow-down');
            assert.strictEqual(config.state_class, 'measurement');
            assert.strictEqual(config.json_attributes_template, "{{ {'status': value_json.batt_saver_mode_sev_lvl_status, 'status_color': value_json.batt_saver_mode_sev_lvl_status_color, 'last_updated': value_json.batt_saver_mode_sev_lvl_last_updated} | tojson }}");
        });

        it('should map EOL READ correctly', () => {
            const diagResponse = {
                name: 'EOL READ',
                diagnosticElements: [{ name: 'EOL READ', value: '100', uom: '%' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:oil-level');
            assert.strictEqual(config.state_class, 'measurement');
            assert.strictEqual(config.json_attributes_template, "{{ {'status': value_json.eol_read_status, 'status_color': value_json.eol_read_status_color, 'last_updated': value_json.eol_read_last_updated} | tojson }}");
        });

        it('should map ODO READ MI correctly', () => {
            const diagResponse = {
                name: 'ODO READ MI',
                diagnosticElements: [{ name: 'ODO READ MI', value: '31000', uom: 'mi' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:counter');
            assert.strictEqual(config.state_class, 'total_increasing');
            assert.strictEqual(config.device_class, 'distance');
        });

        it('should map TRIP A ODO MI correctly', () => {
            const diagResponse = {
                name: 'TRIP A ODO MI',
                diagnosticElements: [{ name: 'TRIP A ODO MI', value: '78', uom: 'mi' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:map-marker-distance');
            assert.strictEqual(config.state_class, 'measurement');
            assert.strictEqual(config.device_class, 'distance');
        });

        it('should map LEFT FRONT TIRE PRESSURE PSI correctly', () => {
            const diagResponse = {
                name: 'LEFT FRONT TIRE PRESSURE PSI',
                diagnosticElements: [{ name: 'LEFT FRONT TIRE PRESSURE PSI', value: '35', uom: 'psi' }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:car-tire-alert');
            assert.strictEqual(config.state_class, 'measurement');
        });

        it('should map EXHST FL LEVL WARN IND correctly', () => {
            const diagResponse = {
                name: 'EXHST FL LEVL WARN IND',
                diagnosticElements: [{ name: 'EXHST FL LEVL WARN IND', value: '0', uom: null }]
            };
            const d = new Diagnostic(diagResponse);
            const config = mqtt.getConfigPayload(d, d.diagnosticElements[0]);
            assert.strictEqual(config.icon, 'mdi:gauge');
            assert.strictEqual(config.state_class, 'measurement');
        });
    });
});
    describe('Advanced Diagnostics', () => {
        let advDiag;
        let mqtt;
        let vehicle;

        beforeEach(() => {
            vehicle = new Vehicle({ make: 'Test', model: 'Car', vin: 'TEST123', year: 2024 });
            mqtt = new MQTT(vehicle);
            const advDiagnosticsResponse = _.get(apiV3Response, 'response.data.advDiagnostics');
            advDiag = new AdvancedDiagnostic(advDiagnosticsResponse);
        });

        describe('getAdvancedDiagnosticConfig', () => {
            it('should generate config for advanced diagnostic system', () => {
                const system = advDiag.diagnosticSystems[0]; // Engine and Transmission
                const config = mqtt.getAdvancedDiagnosticConfig(system, advDiag.cts);
                
                assert.ok(config.topic);
                assert.ok(config.payload);
                assert.strictEqual(config.payload.unique_id, 'TEST123-engine_and_transmission_system');
                assert.strictEqual(config.payload.name, 'Engine and Transmission System');
                assert.strictEqual(config.payload.icon, 'mdi:engine');
                assert.strictEqual(config.payload.state_topic, 'homeassistant/TEST123/adv_diag/state');
            });

            it('should set correct icons for each system type', () => {
                const expectedIcons = {
                    'ENGINE_AND_TRANSMISSION_SYSTEM': 'mdi:engine',
                    'ANTILOCK_BRAKING_SYSTEM': 'mdi:car-brake-abs',
                    'STABILITRAK_STABILITY_CONTROL_SYSTEM': 'mdi:car-esp',
                    'AIRBAG_SYSTEM': 'mdi:airbag',
                    'EMISSIONS_SYSTEM': 'mdi:smoke',
                    'ONSTAR_SYSTEM': 'mdi:car-connected',
                    'ELECTRIC_LAMP_SYSTEM': 'mdi:lightbulb-group'
                };

                advDiag.diagnosticSystems.forEach(system => {
                    const config = mqtt.getAdvancedDiagnosticConfig(system, advDiag.cts);
                    assert.strictEqual(config.payload.icon, expectedIcons[system.systemLabel]);
                });
            });

            it('should include system description in attributes', () => {
                const system = advDiag.diagnosticSystems[0];
                const config = mqtt.getAdvancedDiagnosticConfig(system, advDiag.cts);
                
                assert.ok(config.attributes.description);
                assert.ok(config.attributes.description.length > 0);
            });

            it('should include individual subsystem attributes', () => {
                const system = advDiag.diagnosticSystems[0]; // Engine system has 11 subsystems
                const config = mqtt.getAdvancedDiagnosticConfig(system, advDiag.cts);
                
                // Check for displacement on demand subsystem
                assert.ok(config.attributes.displacement_on_demand_subsystem);
                assert.strictEqual(config.attributes.displacement_on_demand_subsystem.status, 'NO ACTION REQUIRED');
                assert.strictEqual(config.attributes.displacement_on_demand_subsystem.status_color, 'GREEN');
                assert.ok(config.attributes.displacement_on_demand_subsystem.description);
            });

            it('should use default icon for unknown system type', () => {
                const unknownSystem = {
                    systemId: '99',
                    systemName: 'Unknown System',
                    systemLabel: 'UNKNOWN_SYSTEM',
                    systemStatus: 'NO_ACTION_REQUIRED',
                    systemStatusColor: 'GREEN',
                    subsystems: []
                };
                
                const config = mqtt.getAdvancedDiagnosticConfig(unknownSystem, advDiag.cts);
                assert.strictEqual(config.payload.icon, 'mdi:car-info');
            });
        });

        describe('getAdvancedDiagnosticStatePayload', () => {
            it('should generate state payload for all systems', () => {
                const statePayload = mqtt.getAdvancedDiagnosticStatePayload(advDiag);
                
                assert.ok(statePayload.engine_and_transmission_system);
                assert.ok(statePayload.engine_and_transmission_system_attr);
                assert.strictEqual(statePayload.engine_and_transmission_system, 'NO_ACTION_REQUIRED');
            });

            it('should include standard attributes in state payload', () => {
                const statePayload = mqtt.getAdvancedDiagnosticStatePayload(advDiag);
                const engineAttr = statePayload.engine_and_transmission_system_attr;
                
                assert.strictEqual(engineAttr.status_color, 'GREEN');
                assert.strictEqual(engineAttr.last_updated, advDiag.cts);
                assert.strictEqual(engineAttr.dtc_count, 0);
                assert.ok(engineAttr.description);
            });

            it('should include all subsystems as individual attributes', () => {
                const statePayload = mqtt.getAdvancedDiagnosticStatePayload(advDiag);
                const engineAttr = statePayload.engine_and_transmission_system_attr;
                
                // Engine system should have 11 subsystems as individual attributes
                assert.ok(engineAttr.displacement_on_demand_subsystem);
                assert.ok(engineAttr.fuel_management_subsystem);
                assert.ok(engineAttr.transmission_subsystem);
                
                // Each subsystem should have required fields
                const dodSub = engineAttr.displacement_on_demand_subsystem;
                assert.ok(dodSub.name);
                assert.ok(dodSub.status);
                assert.ok(dodSub.status_color);
                assert.strictEqual(typeof dodSub.dtc_count, 'number');
            });

            it('should generate state for all 7 diagnostic systems', () => {
                const statePayload = mqtt.getAdvancedDiagnosticStatePayload(advDiag);
                
                const systemKeys = Object.keys(statePayload).filter(k => !k.endsWith('_attr'));
                assert.strictEqual(systemKeys.length, 7);
                
                assert.ok(statePayload.engine_and_transmission_system);
                assert.ok(statePayload.antilock_braking_system);
                assert.ok(statePayload.airbag_system);
                assert.ok(statePayload.emissions_system);
                assert.ok(statePayload.onstar_system);
            });

            it('should not include subsystems_with_issues when no issues', () => {
                const statePayload = mqtt.getAdvancedDiagnosticStatePayload(advDiag);
                const engineAttr = statePayload.engine_and_transmission_system_attr;
                
                assert.strictEqual(engineAttr.subsystems_with_issues, undefined);
            });
        });
    });
