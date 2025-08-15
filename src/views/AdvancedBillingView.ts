import { IAdvancedBilling, BillingStatus } from '../models/AdvancedBilling';

export interface AdvancedBillingResponse {
  id: string;
  billingId: number;
  clientId: string;
  clientKey?: number;
  startDate: string;
  endDate: string;
  productKey: number;
  billDate: string;
  isActive: boolean;
  status: BillingStatus;
  clinicName: string;
  isCurrentlyActive: boolean;
  daysRemaining: number;
  billingCycleDays: number;
  isOverdue: boolean;
  dateCreated: string;
  dateModified: string;
}

export interface AdvancedBillingListResponse {
  billings: AdvancedBillingResponse[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export interface AdvancedBillingStatsResponse {
  totalBillings: number;
  activeBillings: number;
  overdueBillings: number;
  upcomingBillings: number;
  totalRevenue: number;
  topClients: Array<{ clientId: string; billingCount: number; totalCycles: number }>;
  topClinics: Array<{ clinic: string; billingCount: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
}

export interface BillingSummaryResponse {
  overview: {
    total: number;
    active: number;
    overdue: number;
    upcoming: number;
  };
  recentActivity: AdvancedBillingResponse[];
  criticalAlerts: {
    overdueBillings: AdvancedBillingResponse[];
    expiringSoon: AdvancedBillingResponse[];
  };
}

export class AdvancedBillingView {
  /**
   * Format single advanced billing for response
   */
  static formatBilling(billing: IAdvancedBilling): AdvancedBillingResponse {
    return {
      id: billing._id.toString(),
      billingId: billing.billingId,
      clientId: billing.clientId?.trim() || '',
      clientKey: billing.clientKey,
      startDate: billing.startDate.toISOString(),
      endDate: billing.endDate.toISOString(),
      productKey: billing.productKey,
      billDate: billing.billDate.toISOString(),
      isActive: billing.isActive,
      status: billing.status,
      clinicName: billing.clinicName?.trim() || '',
      isCurrentlyActive: billing.isCurrentlyActive || false,
      daysRemaining: billing.daysRemaining || 0,
      billingCycleDays: billing.billingCycleDays || 0,
      isOverdue: billing.isOverdue || false,
      dateCreated: billing.dateCreated.toISOString(),
      dateModified: billing.dateModified.toISOString()
    };
  }

  /**
   * Format multiple billings for response - using map for optimization
   */
  static formatBillings(billings: IAdvancedBilling[]): AdvancedBillingResponse[] {
    return billings.map(billing => this.formatBilling(billing));
  }

  /**
   * Format billing list with pagination
   */
  static formatBillingList(data: {
    billings: IAdvancedBilling[];
    total: number;
    page: number;
    totalPages: number;
    limit?: number;
  }): AdvancedBillingListResponse {
    return {
      billings: this.formatBillings(data.billings),
      pagination: {
        total: data.total,
        page: data.page,
        totalPages: data.totalPages,
        limit: data.limit || 50
      }
    };
  }

  /**
   * Format billing statistics
   */
  static formatBillingStats(stats: {
    totalBillings: number;
    activeBillings: number;
    overdueBillings: number;
    upcomingBillings: number;
    totalRevenue: number;
    topClients: Array<{ clientId: string; billingCount: number; totalCycles: number }>;
    topClinics: Array<{ clinic: string; billingCount: number }>;
    statusDistribution: Array<{ status: string; count: number }>;
  }): AdvancedBillingStatsResponse {
    return {
      totalBillings: stats.totalBillings,
      activeBillings: stats.activeBillings,
      overdueBillings: stats.overdueBillings,
      upcomingBillings: stats.upcomingBillings,
      totalRevenue: stats.totalRevenue,
      topClients: stats.topClients.map(client => ({
        clientId: client.clientId?.trim() || 'Unknown',
        billingCount: client.billingCount,
        totalCycles: client.totalCycles
      })),
      topClinics: stats.topClinics.map(clinic => ({
        clinic: clinic.clinic?.trim() || 'Unknown',
        billingCount: clinic.billingCount
      })),
      statusDistribution: stats.statusDistribution.map(item => ({
        status: item.status || 'Unknown',
        count: item.count
      }))
    };
  }

  /**
   * Format billing summary for dashboard
   */
  static formatBillingSummary(summary: {
    overview: {
      total: number;
      active: number;
      overdue: number;
      upcoming: number;
    };
    recentActivity: IAdvancedBilling[];
    criticalAlerts: {
      overdueBillings: IAdvancedBilling[];
      expiringSoon: IAdvancedBilling[];
    };
  }): BillingSummaryResponse {
    return {
      overview: summary.overview,
      recentActivity: this.formatBillings(summary.recentActivity),
      criticalAlerts: {
        overdueBillings: this.formatBillings(summary.criticalAlerts.overdueBillings),
        expiringSoon: this.formatBillings(summary.criticalAlerts.expiringSoon)
      }
    };
  }

  /**
   * Format for frontend compatibility (if needed for mock data replacement)
   */
  static formatBillingForFrontend(billing: IAdvancedBilling): any {
    return {
      id: billing._id.toString(),
      billingId: billing.billingId,
      client: {
        id: billing.clientId?.trim() || '',
        key: billing.clientKey
      },
      cycle: {
        startDate: billing.startDate.toISOString().split('T')[0], // YYYY-MM-DD format
        endDate: billing.endDate.toISOString().split('T')[0],
        duration: billing.billingCycleDays || 0,
        daysRemaining: billing.daysRemaining || 0
      },
      billing: {
        date: billing.billDate.toISOString().split('T')[0],
        isOverdue: billing.isOverdue || false,
        productKey: billing.productKey
      },
      status: {
        current: billing.status,
        isActive: billing.isActive,
        isCurrentlyActive: billing.isCurrentlyActive || false
      },
      clinic: billing.clinicName?.trim() || '',
      metadata: {
        created: billing.dateCreated.toISOString(),
        updated: billing.dateModified.toISOString()
      }
    };
  }

  /**
   * Format multiple billings for frontend compatibility
   */
  static formatBillingsForFrontend(billings: IAdvancedBilling[]): any[] {
    return billings.map(billing => this.formatBillingForFrontend(billing));
  }

  /**
   * Format client billing group
   */
  static formatClientBillings(clientId: string, billings: IAdvancedBilling[]): {
    clientId: string;
    billings: AdvancedBillingResponse[];
    summary: {
      total: number;
      active: number;
      overdue: number;
      totalCycleDays: number;
      avgCycleDays: number;
    };
  } {
    const formattedBillings = this.formatBillings(billings);
    
    // Calculate summary using reduce for optimization
    const summary = billings.reduce((acc, billing) => {
      acc.total += 1;
      if (billing.isActive) {acc.active += 1;}
      if (billing.isOverdue) {acc.overdue += 1;}
      acc.totalCycleDays += billing.billingCycleDays || 0;
      return acc;
    }, { total: 0, active: 0, overdue: 0, totalCycleDays: 0, avgCycleDays: 0 });
    
    summary.avgCycleDays = summary.total > 0 ? Math.round(summary.totalCycleDays / summary.total) : 0;
    
    return {
      clientId: clientId.trim(),
      billings: formattedBillings,
      summary
    };
  }

  /**
   * Format clinic billing group
   */
  static formatClinicBillings(clinicName: string, billings: IAdvancedBilling[]): {
    clinic: string;
    billings: AdvancedBillingResponse[];
    summary: {
      total: number;
      active: number;
      overdue: number;
      uniqueClients: number;
    };
  } {
    const formattedBillings = this.formatBillings(billings);
    
    // Calculate unique clients using Set for optimization
    const uniqueClients = new Set(billings.map(b => b.clientId)).size;
    
    const summary = billings.reduce((acc, billing) => {
      acc.total += 1;
      if (billing.isActive) {acc.active += 1;}
      if (billing.isOverdue) {acc.overdue += 1;}
      return acc;
    }, { total: 0, active: 0, overdue: 0, uniqueClients });
    
    return {
      clinic: clinicName.trim(),
      billings: formattedBillings,
      summary
    };
  }

  /**
   * Format billing calendar events (for calendar view integration)
   */
  static formatBillingsForCalendar(billings: IAdvancedBilling[]): Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    color: string;
    extendedProps: {
      billingId: number;
      clientId: string;
      status: BillingStatus;
      isOverdue: boolean;
      daysRemaining: number;
    };
  }> {
    return billings.map(billing => ({
      id: billing._id.toString(),
      title: `Billing: ${billing.clientId} (${billing.status})`,
      start: billing.billDate.toISOString(),
      end: billing.endDate.toISOString(),
      color: this.getBillingColor(billing),
      extendedProps: {
        billingId: billing.billingId,
        clientId: billing.clientId?.trim() || '',
        status: billing.status,
        isOverdue: billing.isOverdue || false,
        daysRemaining: billing.daysRemaining || 0
      }
    }));
  }

  /**
   * Get color based on billing status and urgency
   */
  private static getBillingColor(billing: IAdvancedBilling): string {
    if (billing.isOverdue) {return '#f44336';} // Red for overdue
    if (billing.status === BillingStatus.CANCELLED) {return '#9e9e9e';} // Gray for cancelled
    if (billing.status === BillingStatus.COMPLETED) {return '#4caf50';} // Green for completed
    if (billing.status === BillingStatus.SUSPENDED) {return '#ff9800';} // Orange for suspended
    if (billing.daysRemaining && billing.daysRemaining <= 7) {return '#ff9800';} // Orange for urgent
    return '#2196f3'; // Blue for active
  }

  /**
   * Format status distribution for charts
   */
  static formatStatusDistributionForChart(distribution: Array<{ status: string; count: number }>): {
    labels: string[];
    data: number[];
    colors: string[];
  } {
    const statusColors: Record<string, string> = {
      [BillingStatus.ACTIVE]: '#4caf50',
      [BillingStatus.INACTIVE]: '#9e9e9e',
      [BillingStatus.CANCELLED]: '#f44336',
      [BillingStatus.COMPLETED]: '#2196f3',
      [BillingStatus.SUSPENDED]: '#ff9800'
    };
    
    return {
      labels: distribution.map(item => item.status),
      data: distribution.map(item => item.count),
      colors: distribution.map(item => statusColors[item.status] || '#607d8b')
    };
  }

  /**
   * Format revenue trends data
   */
  static formatRevenueTrends(billings: IAdvancedBilling[]): {
    monthlyRevenue: Array<{ month: string; revenue: number; billingCount: number }>;
    statusBreakdown: Array<{ status: string; revenue: number; percentage: number }>;
  } {
    // Group by month using reduce for optimization
    const monthlyData = billings.reduce((acc, billing) => {
      const month = billing.billDate.toISOString().substring(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { revenue: 0, billingCount: 0 };
      }
      acc[month].revenue += 100; // Placeholder revenue calculation
      acc[month].billingCount += 1;
      return acc;
    }, {} as Record<string, { revenue: number; billingCount: number }>);
    
    const monthlyRevenue = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      billingCount: data.billingCount
    }));
    
    // Status breakdown
    const statusData = billings.reduce((acc, billing) => {
      if (!acc[billing.status]) {
        acc[billing.status] = 0;
      }
      acc[billing.status] += 100; // Placeholder revenue
      return acc;
    }, {} as Record<string, number>);
    
    const totalRevenue = Object.values(statusData).reduce((sum, revenue) => sum + revenue, 0);
    
    const statusBreakdown = Object.entries(statusData).map(([status, revenue]) => ({
      status,
      revenue,
      percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0
    }));
    
    return {
      monthlyRevenue,
      statusBreakdown
    };
  }
}
