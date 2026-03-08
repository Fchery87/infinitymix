/**
 * Alerting Service
 * 
 * Service for sending alerts when monitoring thresholds are breached.
 * Supports multiple notification channels.
 */

import { getMonitoringConfig, type MonitoringConfig } from './config';

type AlertSeverity = 'info' | 'warning' | 'critical';

interface AlertPayload {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metricName: string;
  metricValue: number;
  threshold: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface AlertHistory {
  id: string;
  payload: AlertPayload;
  sent: boolean;
  sentAt?: string;
  channels: string[];
  error?: string;
}

class AlertingService {
  private config: MonitoringConfig;
  private alertHistory: Map<string, AlertHistory> = new Map();
  
  constructor(config?: MonitoringConfig) {
    this.config = config || getMonitoringConfig();
  }
  
  /**
   * Send an alert through all configured channels
   */
  async sendAlert(payload: AlertPayload): Promise<void> {
    const history: AlertHistory = {
      id: payload.id,
      payload,
      sent: false,
      channels: [],
    };
    
    this.alertHistory.set(payload.id, history);
    
    if (!this.config.enabled) {
      console.log('[Alerting] Alerts disabled, logging to console only:', payload);
      return;
    }
    
    const channels: Array<{ name: string; send: () => Promise<void> }> = [];
    
    if (this.config.notifications.email?.enabled) {
      channels.push({ name: 'email', send: () => this.sendEmailAlert(payload) });
    }
    
    if (this.config.notifications.slack?.enabled) {
      channels.push({ name: 'slack', send: () => this.sendSlackAlert(payload) });
    }
    
    if (this.config.notifications.pagerDuty?.enabled) {
      channels.push({ name: 'pagerDuty', send: () => this.sendPagerDutyAlert(payload) });
    }
    
    // Always log to console
    channels.push({ name: 'console', send: () => this.sendConsoleAlert(payload) });
    
    for (const channel of channels) {
      try {
        await channel.send();
        history.channels.push(channel.name);
      } catch (error) {
        console.error(`[Alerting] Failed to send ${channel.name} alert:`, error);
        history.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }
    
    history.sent = history.channels.length > 0;
    history.sentAt = new Date().toISOString();
    this.alertHistory.set(payload.id, history);
  }
  
  /**
   * Send email alert
   */
  private async sendEmailAlert(payload: AlertPayload): Promise<void> {
    const { email } = this.config.notifications;
    if (!email?.enabled) return;
    
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    console.log('[Alerting] Email alert:', {
      to: email.recipients,
      subject: `[${payload.severity.toUpperCase()}] ${payload.title}`,
      body: payload.message,
    });
  }
  
  /**
   * Send Slack alert
   */
  private async sendSlackAlert(payload: AlertPayload): Promise<void> {
    const { slack } = this.config.notifications;
    if (!slack?.enabled || !slack.webhookUrl) return;
    
    const colorMap: Record<AlertSeverity, string> = {
      info: '#36a64f',
      warning: '#ff9900',
      critical: '#ff0000',
    };
    
    const slackPayload = {
      channel: slack.channel,
      username: 'InfinityMix Alerts',
      icon_emoji: ':warning:',
      attachments: [
        {
          color: colorMap[payload.severity],
          title: payload.title,
          text: payload.message,
          fields: [
            {
              title: 'Metric',
              value: payload.metricName,
              short: true,
            },
            {
              title: 'Value',
              value: payload.metricValue.toString(),
              short: true,
            },
            {
              title: 'Threshold',
              value: payload.threshold.toString(),
              short: true,
            },
            {
              title: 'Timestamp',
              value: new Date(payload.timestamp).toLocaleString(),
              short: true,
            },
          ],
          footer: 'InfinityMix Monitoring',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };
    
    try {
      const response = await fetch(slack.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
      });
      
      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }
    } catch (error) {
      console.error('[Alerting] Failed to send Slack alert:', error);
      throw error;
    }
  }
  
  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(payload: AlertPayload): Promise<void> {
    const { pagerDuty } = this.config.notifications;
    if (!pagerDuty?.enabled || !pagerDuty.integrationKey) return;
    
    if (payload.severity !== 'critical') {
      // Only send critical alerts to PagerDuty
      return;
    }
    
    const pagerDutyPayload = {
      routing_key: pagerDuty.integrationKey,
      event_action: 'trigger',
      dedup_key: payload.id,
      payload: {
        summary: payload.title,
        severity: 'critical',
        source: 'infinitymix-monitoring',
        custom_details: {
          message: payload.message,
          metric: payload.metricName,
          value: payload.metricValue,
          threshold: payload.threshold,
          ...payload.metadata,
        },
      },
    };
    
    try {
      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pagerDutyPayload),
      });
      
      if (!response.ok) {
        throw new Error(`PagerDuty API error: ${response.status}`);
      }
    } catch (error) {
      console.error('[Alerting] Failed to send PagerDuty alert:', error);
      throw error;
    }
  }
  
  /**
   * Send console alert (always sent)
   */
  private async sendConsoleAlert(payload: AlertPayload): Promise<void> {
    const icon = payload.severity === 'critical' ? '🔴' : payload.severity === 'warning' ? '🟡' : '🔵';
    console.log(`${icon} [${payload.severity.toUpperCase()}] ${payload.title}`);
    console.log(`   ${payload.message}`);
    console.log(`   Metric: ${payload.metricName} = ${payload.metricValue} (threshold: ${payload.threshold})`);
  }
  
  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): AlertHistory[] {
    return Array.from(this.alertHistory.values())
      .sort((a, b) => new Date(b.payload.timestamp).getTime() - new Date(a.payload.timestamp).getTime())
      .slice(0, limit);
  }
  
  /**
   * Clear old alert history
   */
  clearOldAlerts(olderThanHours: number = 24): void {
    const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);
    for (const [id, history] of this.alertHistory.entries()) {
      if (new Date(history.payload.timestamp).getTime() < cutoff) {
        this.alertHistory.delete(id);
      }
    }
  }
}

// Singleton instance
let alertingService: AlertingService | null = null;

export function getAlertingService(): AlertingService {
  if (!alertingService) {
    alertingService = new AlertingService();
  }
  return alertingService;
}

export function resetAlertingService(): void {
  alertingService = null;
}

export { AlertingService, type AlertPayload, type AlertSeverity, type AlertHistory };
