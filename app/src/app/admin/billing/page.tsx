'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  TrendingUp,
  Users,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Crown,
  Clock,
  RefreshCw,
  ExternalLink,
  BarChart3,
} from 'lucide-react';

type PlanDistribution = {
  tier: 'free' | 'pro' | 'studio';
  count: number;
  percentage: number;
};

type QuotaAlert = {
  userId: string;
  userName: string;
  userEmail: string;
  tier: string;
  quotaUsed: number;
  quotaMax: number;
  percentage: number;
};

type StripeEvent = {
  id: string;
  type: string;
  status: 'succeeded' | 'failed' | 'pending';
  createdAt: string;
  data: {
    amount?: number;
    currency?: string;
    customerEmail?: string;
    description?: string;
  };
};

type BillingData = {
  revenue: {
    mrr: number;
    mrrChange: number;
    arr: number;
    totalRevenue30d: number;
    churnRate: number;
    arpu: number;
  };
  planDistribution: PlanDistribution[];
  quotaAlerts: QuotaAlert[];
  stripeEvents: StripeEvent[];
  growth: {
    newSubscribers: number;
    cancellations: number;
    upgrades: number;
    downgrades: number;
  };
};

const tierColors: Record<string, string> = {
  free: 'bg-gray-500',
  pro: 'bg-blue-500',
  studio: 'bg-purple-500',
};

const tierIcons: Record<string, typeof Crown> = {
  free: Users,
  pro: Zap,
  studio: Crown,
};

const eventTypeLabels: Record<string, string> = {
  'checkout.session.completed': 'New Subscription',
  'customer.subscription.updated': 'Subscription Updated',
  'customer.subscription.deleted': 'Cancellation',
  'invoice.paid': 'Payment Received',
  'invoice.payment_failed': 'Payment Failed',
  'charge.refunded': 'Refund Issued',
};

const eventStatusColors: Record<string, string> = {
  succeeded: 'text-green-500 bg-green-500/10',
  failed: 'text-red-500 bg-red-500/10',
  pending: 'text-yellow-500 bg-yellow-500/10',
};

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCurrencyDecimal(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminBillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/billing');
      if (!response.ok) throw new Error('Failed to load billing data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 bg-background/60 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">Back to Admin</Button>
              </Link>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Billing Dashboard
              </h1>
            </div>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-24 text-red-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
            <p>{error}</p>
            <Button onClick={loadData} variant="outline" className="mt-4">Retry</Button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Revenue Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-1">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <DollarSign className="w-5 h-5 text-green-500" />
                    </div>
                    <div className={`flex items-center gap-1 text-sm ${data.revenue.mrrChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {data.revenue.mrrChange >= 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      {Math.abs(data.revenue.mrrChange).toFixed(1)}%
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2">{formatCurrency(data.revenue.mrr)}</p>
                  <p className="text-sm text-gray-500">Monthly Recurring Revenue</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-1">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2">{formatCurrency(data.revenue.arr)}</p>
                  <p className="text-sm text-gray-500">Annual Run Rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-1">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <BarChart3 className="w-5 h-5 text-purple-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2">{formatCurrencyDecimal(data.revenue.arpu)}</p>
                  <p className="text-sm text-gray-500">Avg Revenue / User</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-1">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <ArrowDownRight className="w-5 h-5 text-red-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold mt-2">{data.revenue.churnRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-500">Monthly Churn Rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Growth & Plan Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plan Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" /> Plan Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.planDistribution.map((plan) => {
                      const Icon = tierIcons[plan.tier];
                      return (
                        <div key={plan.tier} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-gray-400" />
                              <span className="font-medium capitalize">{plan.tier}</span>
                              <Badge
                                variant="secondary"
                                className={`${tierColors[plan.tier]} text-white text-[10px] px-1.5`}
                              >
                                {plan.count} users
                              </Badge>
                            </div>
                            <span className="text-sm text-gray-500">{plan.percentage.toFixed(1)}%</span>
                          </div>
                          <Progress value={plan.percentage} variant={plan.tier === 'free' ? 'default' : 'success'} />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Growth Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" /> Growth (30 days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-black/20 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-500">+{data.growth.newSubscribers}</p>
                      <p className="text-xs text-gray-500">New Subscribers</p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-lg text-center">
                      <p className="text-2xl font-bold text-red-500">-{data.growth.cancellations}</p>
                      <p className="text-xs text-gray-500">Cancellations</p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-500">{data.growth.upgrades}</p>
                      <p className="text-xs text-gray-500">Upgrades</p>
                    </div>
                    <div className="p-4 bg-black/20 rounded-lg text-center">
                      <p className="text-2xl font-bold text-yellow-500">{data.growth.downgrades}</p>
                      <p className="text-xs text-gray-500">Downgrades</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-black/20 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">30-Day Revenue</span>
                      <span className="font-medium">{formatCurrency(data.revenue.totalRevenue30d)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quota Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" /> Quota Usage Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.quotaAlerts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No quota alerts at this time</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.quotaAlerts.map((alert) => (
                      <div
                        key={alert.userId}
                        className="p-4 bg-black/20 rounded-lg border border-white/5"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium">{alert.userName}</span>
                            <span className="text-sm text-gray-500 ml-2">{alert.userEmail}</span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`${tierColors[alert.tier]} text-white text-xs`}
                          >
                            {alert.tier}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress
                            value={alert.percentage}
                            variant={alert.percentage >= 95 ? 'error' : alert.percentage >= 80 ? 'warning' : 'default'}
                            className="flex-1"
                          />
                          <span className={`text-sm font-medium ${alert.percentage >= 95 ? 'text-red-500' : 'text-yellow-500'}`}>
                            {alert.percentage.toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {alert.quotaUsed} / {alert.quotaMax} minutes used
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stripe Webhook Event Log */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5" /> Stripe Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.stripeEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No recent Stripe events</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.stripeEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {eventTypeLabels[event.type] || event.type}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${eventStatusColors[event.status]}`}>
                              {event.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            {event.data.amount && (
                              <span>{formatCurrencyDecimal(event.data.amount)}</span>
                            )}
                            {event.data.customerEmail && (
                              <span>{event.data.customerEmail}</span>
                            )}
                            {event.data.description && (
                              <span className="truncate">{event.data.description}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(event.createdAt)}
                          </span>
                          <a
                            href={`https://dashboard.stripe.com/events/${event.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  );
}
