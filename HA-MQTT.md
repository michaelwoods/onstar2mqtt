Sample configs for MQTT Home Assistant integration.

### Location
Unfortunately, the MQTT Device tracker uses a home/not_home state and the MQTT Json device tracker does not support
the discovery schema so a manual entity configuration is required.

device tracker yaml:
```yaml
device_tracker:
  - platform: mqtt_json
    devices:
      your_car_name: homeassistant/device_tracker/YOUR_CAR_VIN/getlocation/state
```

#### script yaml:
```yaml
alias: Car - Location
sequence:
  - service: mqtt.publish
    data:
      topic: homeassistant/YOUR_CAR_VIN/command
      payload: '{"command": "getLocation"}'
mode: single
icon: 'mdi:map-marker'
```

### Lovelace Dashboard
Create a new dashboard, or use the cards in your own view. The `mdi:car` icon works well here.

![lovelace screenshot](images/lovelace.png)

#### script yaml:
```yaml
alias: Car - Start Vehicle
sequence:
  - service: mqtt.publish
    data:
      topic: homeassistant/YOUR_CAR_VIN/command
      payload: '{"command": "startVehicle"}'
mode: single
icon: 'mdi:car-key'
```
#### Commands:
[OnStarJS Command Docs](https://github.com/samrum/OnStarJS#commands)
1. `getAccountVehicles`
2. `startVehicle`
3. `cancelStartVehicle`
4. `alert`
5. `cancelAlert`
6. `lockDoor`
7. `unlockDoor`
10. `getLocation`

#### dashboard yaml:
```yaml
views:
  badges: []
    cards:
      - type: gauge
        entity: sensor.gas_range_mi
        name: Range Miles
        min: 1
        max: 500
        needle: true
        severity:
          green: 300
          yellow: 100
          red: 0
      - type: gauge
        entity: sensor.fuel_amount_gal
        max: 26
        name: Fuel Level
        min: 0
        needle: true
        unit: G
        severity:
          green: 13
          yellow: 6
          red: 0
      - square: false
        columns: 2
        type: grid
        cards:
          - show_name: true
            show_icon: true
            type: button
            tap_action:
              action: toggle
            entity: script.start_truck
            name: Start
            show_state: false
            icon: mdi:car-key
          - show_name: true
            show_icon: true
            type: button
            tap_action:
              action: toggle
            entity: script.cancel_start
            name: Cancel Start
            show_state: false
            icon: mdi:car-off
          - show_name: true
            show_icon: true
            type: button
            tap_action:
              action: toggle
            entity: script.lock_door
            name: Lock
            show_state: false
            icon: mdi:car-door-lock
          - show_name: true
            show_icon: true
            type: button
            tap_action:
              action: toggle
            entity: script.unlock_door
            name: Unlock
            show_state: false
            icon: mdi:car-door
      - square: false
        columns: 2
        type: grid
        cards:
          - type: gauge
            entity: sensor.tire_pressure_left_front_psi
            min: 1
            max: 45
            severity:
              green: 35
              yellow: 30
              red: 42
          - type: gauge
            entity: sensor.tire_pressure_right_front_psi
            min: 1
            max: 45
            needle: false
            severity:
              green: 35
              yellow: 30
              red: 42
          - type: gauge
            entity: sensor.tire_pressure_left_rear_psi
            max: 45
            severity:
              green: 35
              yellow: 30
              red: 42
          - type: gauge
            entity: sensor.tire_pressure_right_rear_psi
            max: 45
            severity:
              green: 35
              yellow: 30
              red: 42
      - hours_to_show: 12
        graph: line
        type: sensor
        entity: sensor.interm_volt_batt_volt
        detail: 2
      - type: gauge
        entity: sensor.engine_coolant_temp
        severity:
          green: 0
          yellow: 250
          red: 300
        max: 400
        min: 1
      - square: false
        columns: 1
        type: grid
        cards:
          - type: entities
            entities:
              - entity: sensor.lifetime_fuel_econ_mpg
              - entity: sensor.last_trip_fuel_econ_mpg
      - type: gauge
        entity: sensor.oil_life
        max: 100
        needle: false
        severity:
          green: 70
          yellow: 50
          red: 30
```
