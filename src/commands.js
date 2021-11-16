
class Commands {
    static CONSTANTS = {
        ALERT_ACTION: {
            FLASH: 'Flash',
            HONK: 'Honk',
        },
        ALERT_OVERRIDE: {
            DOOR_OPEN: 'DoorOpen',
            IGNITION_ON: 'IgnitionOn'
        },
        CHARGE_OVERRIDE: {
            CHARGE_NOW: 'CHARGE_NOW',
            CANCEL_OVERRIDE: 'CANCEL_OVERRIDE'
        },
        CHARGING_PROFILE_MODE: {
            DEFAULT_IMMEDIATE: 'DEFAULT_IMMEDIATE',
            IMMEDIATE: 'IMMEDIATE',
            DEPARTURE_BASED: 'DEPARTURE_BASED',
            RATE_BASED: 'RATE_BASED',
            PHEV_AFTER_MIDNIGHT: 'PHEV_AFTER_MIDNIGHT'
        },
        CHARGING_PROFILE_RATE: {
            OFFPEAK: 'OFFPEAK',
            MIDPEAK: 'MIDPEAK',
            PEAK: 'PEAK'
        },
        DIAGNOSTICS: {
            ENGINE_COOLANT_TEMP: 'ENGINE COOLANT TEMP',
            ENGINE_RPM: 'ENGINE RPM',
            LAST_TRIP_FUEL_ECONOMY: 'LAST TRIP FUEL ECONOMY',
            EV_ESTIMATED_CHARGE_END: 'EV ESTIMATED CHARGE END',
            EV_BATTERY_LEVEL: 'EV BATTERY LEVEL',
            OIL_LIFE: 'OIL LIFE',
            EV_PLUG_VOLTAGE: 'EV PLUG VOLTAGE',
            LIFETIME_FUEL_ECON: 'LIFETIME FUEL ECON',
            HOTSPOT_CONFIG: 'HOTSPOT CONFIG',
            LIFETIME_FUEL_USED: 'LIFETIME FUEL USED',
            ODOMETER: 'ODOMETER',
            HOTSPOT_STATUS: 'HOTSPOT STATUS',
            LIFETIME_EV_ODOMETER: 'LIFETIME EV ODOMETER',
            EV_PLUG_STATE: 'EV PLUG STATE',
            EV_CHARGE_STATE: 'EV CHARGE STATE',
            TIRE_PRESSURE: 'TIRE PRESSURE',
            AMBIENT_AIR_TEMPERATURE: 'AMBIENT AIR TEMPERATURE',
            LAST_TRIP_DISTANCE: 'LAST TRIP DISTANCE',
            INTERM_VOLT_BATT_VOLT: 'INTERM VOLT BATT VOLT',
            GET_COMMUTE_SCHEDULE: 'GET COMMUTE SCHEDULE',
            GET_CHARGE_MODE: 'GET CHARGE MODE',
            EV_SCHEDULED_CHARGE_START: 'EV SCHEDULED CHARGE START',
            FUEL_TANK_INFO: 'FUEL TANK INFO',
            HANDS_FREE_CALLING: 'HANDS FREE CALLING',
            ENERGY_EFFICIENCY: 'ENERGY EFFICIENCY',
            VEHICLE_RANGE: 'VEHICLE RANGE',
        }
    }

    constructor(onstar) {
        this.onstar = onstar;
    }

    async getAccountVehicles() {
        return this.onstar.getAccountVehicles();
    }

    async startVehicle() {
        return this.onstar.start();
    }

    async cancelStartVehicle() {
        return this.onstar.cancelStart();
    }

    async alert({action = [Commands.CONSTANTS.ALERT_ACTION.FLASH],
                 delay = 0, duration = 1, override = []}) {
        return this.onstar.alert({
            action,
            delay,
            duration,
            override
        });
    }

    async cancelAlert() {
        return this.onstar.cancelAlert();
    }

    async lockDoor({delay = 0}) {
        return this.onstar.lockDoor({delay});
    }

    async unlockDoor({delay = 0}) {
        return this.onstar.unlockDoor({delay});
    }

    async chargeOverride({mode = Commands.CONSTANTS.CHARGE_OVERRIDE.CHARGE_NOW}) {
        return this.onstar.chargeOverride({mode});
    }

    async cancelChargeOverride({mode = Commands.CONSTANTS.CHARGE_OVERRIDE.CANCEL_OVERRIDE}) {
        return this.onstar.chargeOverride({mode});
    }

    async getChargingProfile() {
        return this.onstar.getChargingProfile();
    }

    async setChargingProfile() {
        return this.onstar.setChargingProfile();
    }

    async getLocation() {
        return this.onstar.location();
    }

    async diagnostics({diagnosticItem = [
        Commands.CONSTANTS.DIAGNOSTICS.ODOMETER,
        Commands.CONSTANTS.DIAGNOSTICS.TIRE_PRESSURE,
        Commands.CONSTANTS.DIAGNOSTICS.AMBIENT_AIR_TEMPERATURE,
        Commands.CONSTANTS.DIAGNOSTICS.LAST_TRIP_DISTANCE
    ]}) {
        return this.onstar.diagnostics({diagnosticItem});
    }
}

module.exports = Commands;