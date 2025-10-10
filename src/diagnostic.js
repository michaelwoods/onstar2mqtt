const _ = require('lodash');

const Measurement = require('./measurement');

class Diagnostic {
    constructor(diagResponse) {
        this.name = diagResponse.name;
        // API CHANGE: New API v3 includes group-level status information
        this.displayName = diagResponse.displayName;
        this.status = diagResponse.status;
        this.statusColor = diagResponse.statusColor;
        this.cts = diagResponse.cts;  // Group-level timestamp
        // API CHANGE: New API format changes field names
        // Old: diagnosticElement (singular), unit
        // New: diagnosticElements (plural), uom (unit of measure)
        // Try new format first, fallback to old format for backward compatibility
        const elements = diagResponse.diagnosticElements || diagResponse.diagnosticElement;
        // API CHANGE: New API v3 includes fields without units (like percentages, status codes)
        // Include elements that have a value, even if they don't have a unit
        const validEle = _.filter(
            elements,
            d => _.has(d, 'value')  // Just check if value exists
        );
        this.diagnosticElements = _.map(validEle, e => new DiagnosticElement(e));
        const converted = _.map(_.filter(this.diagnosticElements, e => e.isConvertible),
            e => DiagnosticElement.convert(e));
        this.diagnosticElements.push(...converted);
    }

    hasElements() {
        return this.diagnosticElements.length >= 1;
    }

    toString() {
        let elements = '';
        _.forEach(this.diagnosticElements, e => elements += `  ${e.toString()}\n`)
        return `${this.name}:\n` + elements;
    }
}

class DiagnosticElement {
    /**
     *
     * @param {DiagnosticElement} element
     */
    static convert(element) {
        const { name, message, unit, value, status, statusColor, cts } = element;
        const convertedUnit = Measurement.convertUnit(unit);
        return new DiagnosticElement({
            name: DiagnosticElement.convertName(name, convertedUnit),
            message: message,
            unit: convertedUnit,
            value: Measurement.convertValue(value, unit),
            status: status,
            statusColor: statusColor,
            cts: cts
        })
    }

    static convertName(name, unit) {
        return `${name} ${_.replace(_.toUpper(unit), /\W/g, '')}`;
    }

    /**
     * @param {string} ele.name
     * @param {string|number} ele.value
     * @param {string} ele.unit (old API) or ele.uom (new API)
     * @param {string} ele.status (API v3)
     * @param {string} ele.statusColor (API v3)
     * @param {string} ele.cts (API v3) - timestamp
     */
    constructor(ele) {
        this._name = ele.name;
        this._message = ele.message;
        // API CHANGE: Support both 'uom' (new API) and 'unit' (old API) for backward compatibility
        const unitValue = ele.uom || ele.unit;
        this.measurement = new Measurement(ele.value, unitValue);
        // API CHANGE: Capture element-level status and statusColor from API v3
        this.status = ele.status;
        this.statusColor = ele.statusColor;
        // API CHANGE: Capture element-level cts (timestamp) from API v3
        this.cts = ele.cts;
    }

    get name() {
        return this._name;
    }

    get message() {
        return this._message;
    }

    get value() {
        return this.measurement.value;
    }

    get unit() {
        return this.measurement.unit;
    }

    get isConvertible() {
        return this.measurement.isConvertible;
    }

    toString() {
        return `${this.name}: ${this.measurement.toString()}`;
    }
}

class AdvancedDiagnostic {
    constructor(advDiagResponse) {
        this.advDiagnosticsStatus = advDiagResponse.advDiagnosticsStatus;
        this.advDiagnosticsStatusColor = advDiagResponse.advDiagnosticsStatusColor;
        this.recommendedAction = advDiagResponse.recommendedAction;
        this.cts = advDiagResponse.cts;
        this.diagnosticSystems = _.map(advDiagResponse.diagnosticSystems || [], 
            s => new DiagnosticSystem(s));
    }

    hasSystems() {
        return this.diagnosticSystems.length >= 1;
    }

    toString() {
        let systems = '';
        _.forEach(this.diagnosticSystems, s => systems += `  ${s.toString()}\n`)
        return `Advanced Diagnostics (${this.advDiagnosticsStatus}):\n` + systems;
    }
}

class DiagnosticSystem {
    constructor(systemResponse) {
        this.systemId = systemResponse.systemId;
        this.systemName = systemResponse.systemName;
        this.systemLabel = systemResponse.systemLabel;
        this.systemDescription = systemResponse.systemDescription;
        this.systemStatus = systemResponse.systemStatus;
        this.systemStatusColor = systemResponse.systemStatusColor;
        
        // Analyze subsystems for issues and DTC counts
        const subSystems = systemResponse.subSystems || [];
        this.subsystemsWithIssues = _.filter(subSystems, 
            s => s.subSystemStatus !== 'NO_ACTION_REQUIRED' && s.subSystemStatus !== 'NO ACTION REQUIRED');
        
        // Count total DTCs across all subsystems
        this.dtcCount = _.sumBy(subSystems, s => (s.dtcList || []).length);
        
        // Store all DTCs for detailed info
        this.dtcs = _.flatMap(subSystems, s => 
            _.map(s.dtcList || [], dtc => ({
                subsystem: s.subSystemName,
                ...dtc
            }))
        );
    }

    toString() {
        let issues = this.subsystemsWithIssues.length > 0 
            ? ` (${this.subsystemsWithIssues.length} subsystem issues)` 
            : '';
        let dtcs = this.dtcCount > 0 ? ` [${this.dtcCount} DTCs]` : '';
        return `${this.systemName}: ${this.systemStatus}${issues}${dtcs}`;
    }
}

module.exports = { Diagnostic, DiagnosticElement, AdvancedDiagnostic, DiagnosticSystem };