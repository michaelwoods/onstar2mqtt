#!/usr/bin/env node

// OnStar2MQTT Detection Monitor
// Tracks authentication success rates and detection patterns

const fs = require('fs');
const path = require('path');

class DetectionMonitor {
    constructor(logPath = './data/authentication.log') {
        this.logPath = logPath;
        this.stats = {
            totalAttempts: 0,
            successfulAuths: 0,
            detectionEvents: 0,
            lastSuccess: null,
            lastDetection: null,
            averageAuthTime: 0,
            detectionPatterns: {}
        };
        
        this.loadStats();
    }

    loadStats() {
        const statsPath = path.join(path.dirname(this.logPath), 'detection-stats.json');
        if (fs.existsSync(statsPath)) {
            try {
                this.stats = { ...this.stats, ...JSON.parse(fs.readFileSync(statsPath, 'utf8')) };
            } catch (e) {
                console.error('Failed to load stats:', e.message);
            }
        }
    }

    saveStats() {
        const statsPath = path.join(path.dirname(this.logPath), 'detection-stats.json');
        try {
            fs.writeFileSync(statsPath, JSON.stringify(this.stats, null, 2));
        } catch (e) {
            console.error('Failed to save stats:', e.message);
        }
    }

    logAuthAttempt(success, duration, details = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            success,
            duration,
            ...details
        };

        // Update stats
        this.stats.totalAttempts++;
        if (success) {
            this.stats.successfulAuths++;
            this.stats.lastSuccess = timestamp;
            
            // Update average auth time
            const currentAvg = this.stats.averageAuthTime || 0;
            const count = this.stats.successfulAuths;
            this.stats.averageAuthTime = ((currentAvg * (count - 1)) + duration) / count;
        } else {
            this.stats.detectionEvents++;
            this.stats.lastDetection = timestamp;
            
            // Track detection patterns
            if (details.detectionType) {
                this.stats.detectionPatterns[details.detectionType] = 
                    (this.stats.detectionPatterns[details.detectionType] || 0) + 1;
            }
        }

        // Append to log file
        this.appendToLog(logEntry);
        this.saveStats();
    }

    appendToLog(entry) {
        try {
            const logDir = path.dirname(this.logPath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            fs.appendFileSync(this.logPath, JSON.stringify(entry) + '\n');
        } catch (e) {
            console.error('Failed to write log:', e.message);
        }
    }

    getSuccessRate() {
        if (this.stats.totalAttempts === 0) return 0;
        return (this.stats.successfulAuths / this.stats.totalAttempts * 100).toFixed(2);
    }

    getDetectionRate() {
        if (this.stats.totalAttempts === 0) return 0;
        return (this.stats.detectionEvents / this.stats.totalAttempts * 100).toFixed(2);
    }

    generateReport() {
        const report = {
            summary: {
                totalAttempts: this.stats.totalAttempts,
                successRate: `${this.getSuccessRate()}%`,
                detectionRate: `${this.getDetectionRate()}%`,
                averageAuthTime: `${(this.stats.averageAuthTime / 1000).toFixed(1)}s`,
                lastSuccess: this.stats.lastSuccess,
                lastDetection: this.stats.lastDetection
            },
            detectionPatterns: this.stats.detectionPatterns,
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        const successRate = parseFloat(this.getSuccessRate());
        const detectionRate = parseFloat(this.getDetectionRate());

        if (successRate < 50) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Enable proxy rotation',
                reason: `Low success rate (${successRate}%)`
            });
        }

        if (detectionRate > 30) {
            recommendations.push({
                priority: 'HIGH', 
                action: 'Increase retry backoff time',
                reason: `High detection rate (${detectionRate}%)`
            });
        }

        if (this.stats.averageAuthTime > 60000) {
            recommendations.push({
                priority: 'MEDIUM',
                action: 'Optimize human delay settings',
                reason: `Slow authentication (${(this.stats.averageAuthTime / 1000).toFixed(1)}s average)`
            });
        }

        // Pattern-based recommendations
        Object.entries(this.stats.detectionPatterns).forEach(([pattern, count]) => {
            if (count > 3) {
                recommendations.push({
                    priority: 'MEDIUM',
                    action: `Address ${pattern} detection pattern`,
                    reason: `Frequent pattern detection (${count} times)`
                });
            }
        });

        if (recommendations.length === 0) {
            recommendations.push({
                priority: 'LOW',
                action: 'Continue current configuration',
                reason: 'Performance is within acceptable ranges'
            });
        }

        return recommendations;
    }

    printReport() {
        const report = this.generateReport();
        
        console.log('\n=== OnStar2MQTT Detection Monitor Report ===\n');
        
        console.log('📊 Summary:');
        Object.entries(report.summary).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
        });

        console.log('\n🔍 Detection Patterns:');
        if (Object.keys(report.detectionPatterns).length === 0) {
            console.log('  No patterns detected');
        } else {
            Object.entries(report.detectionPatterns).forEach(([pattern, count]) => {
                console.log(`  ${pattern}: ${count} times`);
            });
        }

        console.log('\n💡 Recommendations:');
        report.recommendations.forEach((rec, index) => {
            const priority = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : '🟢';
            console.log(`  ${index + 1}. ${priority} ${rec.action}`);
            console.log(`     Reason: ${rec.reason}`);
        });

        console.log('\n');
    }

    // Analyze recent trends
    analyzeTrends(hours = 24) {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        const trends = {
            recentAttempts: 0,
            recentSuccesses: 0,
            hourlyBreakdown: {}
        };

        try {
            if (fs.existsSync(this.logPath)) {
                const logs = fs.readFileSync(this.logPath, 'utf8')
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => JSON.parse(line))
                    .filter(entry => new Date(entry.timestamp) > cutoff);

                trends.recentAttempts = logs.length;
                trends.recentSuccesses = logs.filter(log => log.success).length;

                // Group by hour
                logs.forEach(log => {
                    const hour = new Date(log.timestamp).getHours();
                    if (!trends.hourlyBreakdown[hour]) {
                        trends.hourlyBreakdown[hour] = { attempts: 0, successes: 0 };
                    }
                    trends.hourlyBreakdown[hour].attempts++;
                    if (log.success) trends.hourlyBreakdown[hour].successes++;
                });
            }
        } catch (e) {
            console.error('Failed to analyze trends:', e.message);
        }

        return trends;
    }
}

// CLI interface
if (require.main === module) {
    const monitor = new DetectionMonitor();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'report':
            monitor.printReport();
            break;
            
        case 'trends':
            const hours = parseInt(process.argv[3]) || 24;
            const trends = monitor.analyzeTrends(hours);
            console.log(`\n📈 Trends (last ${hours} hours):`);
            console.log(`  Recent attempts: ${trends.recentAttempts}`);
            console.log(`  Recent successes: ${trends.recentSuccesses}`);
            console.log(`  Recent success rate: ${trends.recentAttempts > 0 ? (trends.recentSuccesses / trends.recentAttempts * 100).toFixed(2) : 0}%`);
            break;
            
        case 'log':
            const success = process.argv[3] === 'true';
            const duration = parseInt(process.argv[4]) || 0;
            const detectionType = process.argv[5];
            monitor.logAuthAttempt(success, duration, detectionType ? { detectionType } : {});
            console.log(`Logged ${success ? 'successful' : 'failed'} authentication`);
            break;
            
        default:
            console.log('Usage:');
            console.log('  node detection-monitor.js report           - Show current statistics');
            console.log('  node detection-monitor.js trends [hours]   - Show recent trends'); 
            console.log('  node detection-monitor.js log <success> <duration> [type] - Log auth attempt');
            console.log('');
            console.log('Examples:');
            console.log('  node detection-monitor.js log true 5000');
            console.log('  node detection-monitor.js log false 0 akamai_block');
            console.log('  node detection-monitor.js trends 12');
    }
}

module.exports = DetectionMonitor;
