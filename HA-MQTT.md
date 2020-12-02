Sample configs for MQTT Home Assistant integration.

### Lovelace Dashboard
Create a new dashboard, or use the cards in your own view. The `mdi:car-electric` icon works well here.

![lovelace screenshot](images/lovelace.png)

yaml:
```yaml
views:
  - badges: []
    cards:
      - type: gauge
        entity: sensor.ev_battery_level
        min: 0
        max: 100
        name: Battery
        severity:
          green: 60
          yellow: 40
          red: 15
      - type: gauge
        entity: sensor.ev_range
        min: 0
        max: 420
        name: Range
        severity:
          green: 250
          yellow: 150
          red: 75
      - type: glance
        entities:
          - entity: sensor.tire_pressure_left_front
            name: Left Front
            icon: 'mdi:car-tire-alert'
          - entity: sensor.tire_pressure_right_front
            name: Right Front
            icon: 'mdi:car-tire-alert'
          - entity: sensor.tire_pressure_left_rear
            name: Left Rear
            icon: 'mdi:car-tire-alert'
          - entity: sensor.tire_pressure_right_rear
            name: Right Rear
            icon: 'mdi:car-tire-alert'
        columns: 2
        title: Tires
      - type: glance
        entities:
          - entity: sensor.last_trip_total_distance
            name: Distance
          - entity: sensor.last_trip_electric_econ
            name: Economy
        title: Last Trip
      - type: entities
        title: Mileage
        entities:
          - entity: sensor.odometer
          - entity: sensor.lifetime_energy_used
          - entity: sensor.lifetime_mpge
          - entity: sensor.lifetime_efficiency
          - entity: sensor.electric_economy
      - type: glance
        entities:
          - entity: sensor.ambient_air_temperature
            name: Ambient
          - entity: sensor.hybrid_battery_minimum_temperature
            name: Battery
          - entity: sensor.kewr_daynight_temperature
            name: Outdoor
        title: Temperature
      - type: entities
        entities:
          - entity: binary_sensor.ev_plug_state
          - entity: binary_sensor.ev_charge_state
          - entity: binary_sensor.priority_charge_indicator
          - entity: binary_sensor.priority_charge_status
          - entity: sensor.ev_plug_voltage
          - entity: sensor.interm_volt_batt_volt
          - entity: sensor.charger_power_level
        title: Charging
title: Bolt EV

```

TODO
- Utility meter that resets for monthly LIFETIME ENERGY USED. This seems to only be updated after a full charge, along with other data points.