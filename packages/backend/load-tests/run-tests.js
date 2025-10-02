#!/usr/bin/env node

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load test runner with comprehensive reporting
 */
class LoadTestRunner {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
  }

  /**
   * Run a single Artillery test configuration
   */
  async runTest(configFile, testName) {
    console.log(`\n🚀 Starting ${testName}...`);
    
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const artillery = spawn('npx', ['artillery', 'run', configFile], {
        cwd: __dirname,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      artillery.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      artillery.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      artillery.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        const result = {
          testName,
          configFile,
          exitCode: code,
          duration,
          stdout,
          stderr,
          success: code === 0
        };

        this.testResults.push(result);

        if (code === 0) {
          console.log(`✅ ${testName} completed successfully in ${duration}ms`);
          resolve(result);
        } else {
          console.log(`❌ ${testName} failed with exit code ${code}`);
          reject(new Error(`Test failed with exit code ${code}`));
        }
      });

      artillery.on('error', (error) => {
        console.error(`❌ Failed to start ${testName}:`, error);
        reject(error);
      });
    });
  }

  /**
   * Parse Artillery output for key metrics
   */
  parseMetrics(stdout) {
    const metrics = {};
    
    // Extract key metrics from Artillery output
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      // Response time metrics
      if (line.includes('http.response_time')) {
        const match = line.match(/min: ([\d.]+).*median: ([\d.]+).*max: ([\d.]+).*p95: ([\d.]+).*p99: ([\d.]+)/);
        if (match) {
          metrics.responseTime = {
            min: parseFloat(match[1]),
            median: parseFloat(match[2]),
            max: parseFloat(match[3]),
            p95: parseFloat(match[4]),
            p99: parseFloat(match[5])
          };
        }
      }
      
      // Request rate
      if (line.includes('http.requests')) {
        const match = line.match(/(\d+)/);
        if (match) {
          metrics.totalRequests = parseInt(match[1]);
        }
      }
      
      // Error rate
      if (line.includes('http.request_rate')) {
        const match = line.match(/([\d.]+)\/sec/);
        if (match) {
          metrics.requestRate = parseFloat(match[1]);
        }
      }
      
      // Status codes
      if (line.includes('http.codes')) {
        const codes = {};
        const codeMatches = line.matchAll(/(\d{3}): (\d+)/g);
        for (const match of codeMatches) {
          codes[match[1]] = parseInt(match[2]);
        }
        metrics.statusCodes = codes;
      }
    }
    
    return metrics;
  }

  /**
   * Generate comprehensive test report
   */
  async generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const successfulTests = this.testResults.filter(r => r.success).length;
    const failedTests = this.testResults.length - successfulTests;

    const report = {
      summary: {
        totalTests: this.testResults.length,
        successfulTests,
        failedTests,
        totalDuration,
        timestamp: new Date().toISOString()
      },
      tests: this.testResults.map(result => ({
        ...result,
        metrics: this.parseMetrics(result.stdout)
      })),
      recommendations: this.generateRecommendations()
    };

    // Write detailed report
    const reportPath = path.join(__dirname, 'load-test-summary.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Write human-readable summary
    const summaryPath = path.join(__dirname, 'load-test-summary.md');
    await fs.writeFile(summaryPath, this.generateMarkdownReport(report));

    console.log(`\n📊 Test report generated:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   Markdown: ${summaryPath}`);

    return report;
  }

  /**
   * Generate optimization recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    
    for (const result of this.testResults) {
      const metrics = this.parseMetrics(result.stdout);
      
      if (metrics.responseTime) {
        if (metrics.responseTime.p95 > 5000) {
          recommendations.push(`High P95 response time (${metrics.responseTime.p95}ms) in ${result.testName}. Consider scaling up or optimizing processing.`);
        }
        
        if (metrics.responseTime.p99 > 15000) {
          recommendations.push(`Very high P99 response time (${metrics.responseTime.p99}ms) in ${result.testName}. Check for processing bottlenecks.`);
        }
      }
      
      if (metrics.statusCodes) {
        const errorRate = (metrics.statusCodes['500'] || 0) + (metrics.statusCodes['503'] || 0);
        const totalRequests = Object.values(metrics.statusCodes).reduce((sum, count) => sum + count, 0);
        
        if (errorRate / totalRequests > 0.05) { // 5% error rate
          recommendations.push(`High error rate (${((errorRate / totalRequests) * 100).toFixed(1)}%) in ${result.testName}. Check system capacity and error handling.`);
        }
      }
    }
    
    return recommendations;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    let markdown = `# Load Test Report\n\n`;
    markdown += `**Generated:** ${report.summary.timestamp}\n`;
    markdown += `**Total Duration:** ${(report.summary.totalDuration / 1000).toFixed(1)}s\n`;
    markdown += `**Tests:** ${report.summary.successfulTests}/${report.summary.totalTests} passed\n\n`;

    markdown += `## Test Results\n\n`;
    
    for (const test of report.tests) {
      markdown += `### ${test.testName}\n`;
      markdown += `- **Status:** ${test.success ? '✅ Passed' : '❌ Failed'}\n`;
      markdown += `- **Duration:** ${(test.duration / 1000).toFixed(1)}s\n`;
      
      if (test.metrics.responseTime) {
        markdown += `- **Response Time (ms):**\n`;
        markdown += `  - Median: ${test.metrics.responseTime.median}\n`;
        markdown += `  - P95: ${test.metrics.responseTime.p95}\n`;
        markdown += `  - P99: ${test.metrics.responseTime.p99}\n`;
      }
      
      if (test.metrics.statusCodes) {
        markdown += `- **Status Codes:** ${Object.entries(test.metrics.statusCodes).map(([code, count]) => `${code}: ${count}`).join(', ')}\n`;
      }
      
      markdown += `\n`;
    }

    if (report.recommendations.length > 0) {
      markdown += `## Recommendations\n\n`;
      for (const rec of report.recommendations) {
        markdown += `- ${rec}\n`;
      }
      markdown += `\n`;
    }

    return markdown;
  }

  /**
   * Run all load tests
   */
  async runAllTests() {
    console.log('🎯 Starting comprehensive load testing suite...\n');

    const tests = [
      { config: 'artillery-config.yml', name: 'General Load Test' },
      { config: 'scaling-test.yml', name: 'Auto-scaling Validation' }
    ];

    for (const test of tests) {
      try {
        await this.runTest(test.config, test.name);
        
        // Wait between tests to allow system recovery
        console.log('⏳ Waiting 30 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
      } catch (error) {
        console.error(`Test ${test.name} failed:`, error.message);
        // Continue with other tests
      }
    }

    // Generate final report
    const report = await this.generateReport();
    
    console.log('\n🎉 Load testing completed!');
    console.log(`📈 Summary: ${report.summary.successfulTests}/${report.summary.totalTests} tests passed`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }

    return report;
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new LoadTestRunner();
  
  runner.runAllTests()
    .then(() => {
      console.log('\n✨ All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

export { LoadTestRunner };