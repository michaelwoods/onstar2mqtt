const assert = require('assert');
const _ = require('lodash');

const { Diagnostic, DiagnosticElement, AdvancedDiagnostic, DiagnosticSystem } = require('../src/diagnostic');
const apiResponse = require('./diagnostic.sample.json');
const apiV3Response = require('./diagnostic-sample-anonymized-v3-1.json');

describe('Diagnostics', () => {
    let d;

    describe('Diagnostic', () => {
        // API CHANGE: Test uses old API format path for backward compatibility
        // Old: commandResponse.body.diagnosticResponse[0] with diagnosticElement field
        // New: diagnostics[0] with diagnosticElements field
        // The Diagnostic class now supports both formats
        beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[0]')));

        it('should parse a diagnostic response', () => {
            assert.strictEqual(d.name, 'AMBIENT AIR TEMPERATURE');
            assert.strictEqual(d.diagnosticElements.length, 2);
        });

        it('should toString() correctly', () => {
            const output = d.toString().trimEnd();
            const lines = output.split(/\r\n|\r|\n/);
            assert.strictEqual(lines.length, 3);
            assert.strictEqual(lines[0], 'AMBIENT AIR TEMPERATURE:');
        });

        it('should handle diagnostic response with no valid elements', () => {
            const diagResponse = {
                name: 'TEST',
                // API CHANGE: Using old API field name 'diagnosticElement' for test
                // New API uses 'diagnosticElements' (plural) and 'uom' instead of 'unit'
                // Diagnostic class now supports both formats
                // API CHANGE: Now accepts elements with only value (no unit required)
                diagnosticElement: [
                    { unit: 'test' }, // Missing value - should be rejected
                    {} // Missing both - should be rejected
                ]
            };
            const diagnostic = new Diagnostic(diagResponse);
            assert.strictEqual(diagnostic.diagnosticElements.length, 0);
            assert.strictEqual(diagnostic.hasElements(), false);
        });
    });

    describe('DiagnosticElement', () => {
        beforeEach(() => d = new Diagnostic(_.get(apiResponse, 'commandResponse.body.diagnosticResponse[8]')));
        it('should parse a diagnostic element', () => {
            assert.strictEqual(d.name, 'TIRE PRESSURE');
            assert.ok(_.isArray(d.diagnosticElements));
            assert.strictEqual(d.diagnosticElements.length, 12);
        });

        it('should toString() correctly', () => {
            const output = d.toString().trimEnd();
            const lines = output.split(/\r\n|\r|\n/);
            assert.strictEqual(lines.length, 13);
            assert.strictEqual(lines[0], 'TIRE PRESSURE:');
            assert.strictEqual(lines[1], '  TIRE PRESSURE LF: 240.0kPa');
        });

        it('should strip non-alpha chars', () => {
            assert.strictEqual(DiagnosticElement.convertName('TEMP', '°F'), 'TEMP F');
        });
    });

    describe('AdvancedDiagnostic', () => {
        let advDiag;

        beforeEach(() => {
            const advDiagnosticsResponse = _.get(apiV3Response, 'response.data.advDiagnostics');
            advDiag = new AdvancedDiagnostic(advDiagnosticsResponse);
        });

        it('should parse advanced diagnostics response', () => {
            assert.strictEqual(advDiag.advDiagnosticsStatus, 'NO_ACTION_REQUIRED');
            assert.strictEqual(advDiag.advDiagnosticsStatusColor, 'GREEN');
            assert.strictEqual(advDiag.cts, '2024-03-13T14:11:06.466+00:00');
            assert.ok(_.isArray(advDiag.diagnosticSystems));
        });

        it('should parse all diagnostic systems', () => {
            assert.strictEqual(advDiag.diagnosticSystems.length, 7);
        });

        it('should have systems with correct names', () => {
            const systemNames = advDiag.diagnosticSystems.map(s => s.systemName);
            assert.ok(systemNames.includes('Engine and Transmission System'));
            assert.ok(systemNames.includes('Antilock Braking System'));
            assert.ok(systemNames.includes('Air Bag System'));
            assert.ok(systemNames.includes('Emissions System'));
            assert.ok(systemNames.includes('OnStar System'));
        });

        it('should have hasSystems() method', () => {
            assert.strictEqual(advDiag.hasSystems(), true);
        });

        it('should return false for hasSystems() when no systems', () => {
            const emptyAdvDiag = new AdvancedDiagnostic({
                advDiagnosticsStatus: 'NO_ACTION_REQUIRED',
                advDiagnosticsStatusColor: 'GREEN',
                diagnosticSystems: []
            });
            assert.strictEqual(emptyAdvDiag.hasSystems(), false);
        });

        it('should toString() correctly', () => {
            const output = advDiag.toString();
            assert.ok(output.includes('Advanced Diagnostics'));
            assert.ok(output.includes('NO_ACTION_REQUIRED'));
            assert.ok(output.includes('Engine and Transmission System'));
        });

        it('should handle missing diagnosticSystems', () => {
            const emptyAdvDiag = new AdvancedDiagnostic({
                advDiagnosticsStatus: 'NO_ACTION_REQUIRED',
                advDiagnosticsStatusColor: 'GREEN'
            });
            assert.strictEqual(emptyAdvDiag.diagnosticSystems.length, 0);
        });
    });

    describe('DiagnosticSystem', () => {
        let system;

        beforeEach(() => {
            const advDiagnosticsResponse = _.get(apiV3Response, 'response.data.advDiagnostics');
            const advDiag = new AdvancedDiagnostic(advDiagnosticsResponse);
            system = advDiag.diagnosticSystems[0]; // Engine and Transmission System
        });

        it('should parse system properties', () => {
            assert.strictEqual(system.systemName, 'Engine and Transmission System');
            assert.strictEqual(system.systemLabel, 'ENGINE_AND_TRANSMISSION_SYSTEM');
            assert.strictEqual(system.systemStatus, 'NO_ACTION_REQUIRED');
            assert.strictEqual(system.systemStatusColor, 'GREEN');
            assert.ok(system.systemDescription);
        });

        it('should parse all subsystems', () => {
            assert.ok(_.isArray(system.subsystems));
            assert.strictEqual(system.subsystems.length, 11);
        });

        it('should have subsystem with correct structure', () => {
            const subsystem = system.subsystems[0];
            assert.ok(subsystem.name);
            assert.ok(subsystem.label);
            assert.ok(subsystem.status);
            assert.ok(subsystem.status_color);
            assert.strictEqual(typeof subsystem.dtc_count, 'number');
        });

        it('should find Displacement on Demand subsystem', () => {
            const dodSubsystem = system.subsystems.find(s => s.name.includes('Displacement'));
            assert.ok(dodSubsystem);
            assert.ok(dodSubsystem.name.includes('Displacement on Demand'));
            assert.ok(dodSubsystem.description);
        });

        it('should count DTCs correctly', () => {
            assert.strictEqual(system.dtcCount, 0);
            assert.ok(_.isArray(system.dtcs));
            assert.strictEqual(system.dtcs.length, 0);
        });

        it('should identify subsystems with issues', () => {
            assert.ok(_.isArray(system.subsystemsWithIssues));
            assert.strictEqual(system.subsystemsWithIssues.length, 0);
        });

        it('should toString() correctly', () => {
            const output = system.toString();
            assert.ok(output.includes('Engine and Transmission System'));
            assert.ok(output.includes('NO_ACTION_REQUIRED'));
        });

        it('should handle system with DTCs', () => {
            const systemWithDTC = new DiagnosticSystem({
                systemId: '1',
                systemName: 'Test System',
                systemLabel: 'TEST_SYSTEM',
                systemStatus: 'ACTION_REQUIRED',
                systemStatusColor: 'YELLOW',
                subSystems: [
                    {
                        subSystemName: 'Test Subsystem',
                        subSystemLabel: 'TEST_SUBSYSTEM',
                        subSystemStatus: 'ACTION_REQUIRED',
                        subSystemStatusColor: 'YELLOW',
                        dtcList: [
                            { code: 'P0420', description: 'Catalyst System Efficiency Below Threshold' }
                        ]
                    }
                ]
            });
            assert.strictEqual(systemWithDTC.dtcCount, 1);
            assert.strictEqual(systemWithDTC.dtcs.length, 1);
            assert.strictEqual(systemWithDTC.dtcs[0].code, 'P0420');
            assert.strictEqual(systemWithDTC.subsystemsWithIssues.length, 1);
        });

        it('should handle system with multiple subsystems with issues', () => {
            const systemWithIssues = new DiagnosticSystem({
                systemId: '1',
                systemName: 'Test System',
                systemLabel: 'TEST_SYSTEM',
                systemStatus: 'ACTION_REQUIRED',
                systemStatusColor: 'RED',
                subSystems: [
                    {
                        subSystemName: 'Subsystem 1',
                        subSystemLabel: 'SUBSYSTEM_1',
                        subSystemStatus: 'ACTION_REQUIRED',
                        subSystemStatusColor: 'YELLOW',
                        dtcList: []
                    },
                    {
                        subSystemName: 'Subsystem 2',
                        subSystemLabel: 'SUBSYSTEM_2',
                        subSystemStatus: 'NO_ACTION_REQUIRED',
                        subSystemStatusColor: 'GREEN',
                        dtcList: []
                    },
                    {
                        subSystemName: 'Subsystem 3',
                        subSystemLabel: 'SUBSYSTEM_3',
                        subSystemStatus: 'ACTION REQUIRED',
                        subSystemStatusColor: 'RED',
                        dtcList: []
                    }
                ]
            });
            assert.strictEqual(systemWithIssues.subsystemsWithIssues.length, 2);
            const output = systemWithIssues.toString();
            assert.ok(output.includes('2 subsystem issues'));
        });

        it('should handle missing subSystems array', () => {
            const systemNoSubs = new DiagnosticSystem({
                systemId: '1',
                systemName: 'Test System',
                systemLabel: 'TEST_SYSTEM',
                systemStatus: 'NO_ACTION_REQUIRED',
                systemStatusColor: 'GREEN'
            });
            assert.strictEqual(systemNoSubs.subsystems.length, 0);
            assert.strictEqual(systemNoSubs.dtcCount, 0);
            assert.strictEqual(systemNoSubs.subsystemsWithIssues.length, 0);
        });
    });
});
