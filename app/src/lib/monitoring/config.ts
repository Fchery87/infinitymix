/**
 * Monitoring Configuration
 * 
 * Configuration for monitoring, alerting, and observability.
 * Used by the monitoring infrastructure to track system health.
 */

export interface AlertThresholds {
  // QA Metrics
  qaFailureRateThreshold: number;        // 0-1, alert if failure rate exceeds
  qaRetryRateThreshold: number;          // 0-1, alert if retry rate exceeds
  qaStallDurationMinutes: number;        // Alert if QA check takes longer
  
  // Experiment Metrics
  experimentErrorRateThreshold: number;  // 0-1, alert if variant error rate exceeds
  experimentLatencyThresholdMs: number;  // Alert if p95 latency exceeds
  experimentSampleSizeMin: number;       // Alert if sample size below for significance
  
  // System Health
  jobQueueDepthThreshold: number;        // Alert if pending jobs exceed
  jobFailureRateThreshold: number;       // 0-1, alert if job failure rate exceeds
  renderLatencyThresholdMinutes: number; // Alert if render takes longer
}

export interface NotificationChannels {
  email?: {
    enabled: boolean;
    recipients: string[];
    minSeverity: 'warning' | 'critical';
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
    minSeverity: 'info' | 'warning' | 'critical';
  };
  pagerDuty?: {
    enabled: boolean;
    integrationKey: string;
    minSeverity: 'critical';
  };
}

export interface MonitoringConfig {
  enabled: boolean;
  environment: 'development' | 'staging' | 'production';
  thresholds: AlertThresholds;
  notifications: NotificationChannels;
  metrics: {
    retentionDays: number;
    granularityMinutes: number;
  };
  dashboards: {
    enabled: boolean;
    refreshIntervalSeconds: number;
  };
}

// Default production configuration
export const defaultMonitoringConfig: MonitoringConfig = {
  enabled: true,
  environment: 'production',
  thresholds: {
    // QA: Alert if >10% failure rate or >25% retry rate
    qaFailureRateThreshold: 0.10,
    qaRetryRateThreshold: 0.25,
    qaStallDurationMinutes: 10,
    
    // Experiments: Alert if error rate >5% or latency >10s
    experimentErrorRateThreshold: 0.05,
    experimentLatencyThresholdMs: 10000,
    experimentSampleSizeMin: 100,
    
    // System: Alert if >100 pending jobs or >20% failure rate
    jobQueueDepthThreshold: 100,
    jobFailureRateThreshold: 0.20,
    renderLatencyThresholdMinutes: 30,
  },
  notifications: {
    email: {
      enabled: false,
      recipients: [],
      minSeverity: 'critical',
    },
    slack: {
      enabled: false,
      webhookUrl: '',
      channel: '#infinitymix-alerts',
      minSeverity: 'warning',
    },
    pagerDuty: {
      enabled: false,
      integrationKey: '',
      minSeverity: 'critical',
    },
  },
  metrics: {
    retentionDays: 90,
    granularityMinutes: 5,
  },
  dashboards: {
    enabled: true,
    refreshIntervalSeconds: 30,
  },
};

// Development configuration (more lenient)
export const developmentMonitoringConfig: MonitoringConfig = {
  ...defaultMonitoringConfig,
  environment: 'development',
  thresholds: {
    ...defaultMonitoringConfig.thresholds,
    // More lenient thresholds for development
    qaFailureRateThreshold: 0.20,
    qaRetryRateThreshold: 0.40,
    experimentErrorRateThreshold: 0.10,
    jobQueueDepthThreshold: 200,
  },
  notifications: {
    ...defaultMonitoringConfig.notifications,
    // Only console logging in development
    email: { enabled: false, recipients: [], minSeverity: 'critical' },
    slack: { enabled: false, webhookUrl: '', channel: '', minSeverity: 'warning' },
    pagerDuty: { enabled: false, integrationKey: '', minSeverity: 'critical' },
  },
};

/**
 * Get monitoring configuration based on environment
 */
export function getMonitoringConfig(): MonitoringConfig {
  const env = process.env.NODE_ENV || 'development';
  const environment = env === 'production' ? 'production' : 'development';
  
  return environment === 'production' 
    ? defaultMonitoringConfig 
    : developmentMonitoringConfig;
}

/**
 * Check if a metric value exceeds threshold
 */
export function checkThreshold(
  metricName: keyof AlertThresholds,
  value: number,
  config: MonitoringConfig = getMonitoringConfig()
): { exceeded: boolean; threshold: number; severity: 'warning' | 'critical' } {
  const threshold = config.thresholds[metricName];
  
  if (value > threshold * 1.5) {
    return { exceeded: true, threshold, severity: 'critical' };
  } else if (value > threshold) {
    return { exceeded: true, threshold, severity: 'warning' };
  }
  
  return { exceeded: false, threshold, severity: 'warning' };
}
