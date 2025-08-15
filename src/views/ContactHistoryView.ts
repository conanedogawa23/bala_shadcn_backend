import { IContactHistory } from '@/models/ContactHistory';
import { ContactHistoryStats } from '@/services/ContactHistoryService';

export class ContactHistoryView {
  /**
   * Format single contact history record for API response
   */
  static formatContactHistory(contact: IContactHistory): any {
    return {
      id: contact.id,
      clientId: contact.clientId,
      clinicName: contact.clinicName,
      type: contact.contactType,
      direction: contact.direction,
      subject: contact.subject,
      description: contact.description,
      contactDate: contact.contactDate,
      duration: contact.duration,
      outcome: contact.outcome,
      priority: contact.priority,
      category: contact.category,
      tags: contact.tags || [],
      
      // Follow-up information
      followUp: {
        required: contact.followUpRequired,
        date: contact.followUpDate,
        isOverdue: contact.followUpDate ? contact.followUpDate < new Date() : false
      },
      
      // Communication details
      communication: contact.communication ? {
        method: contact.communication.method,
        phoneNumber: contact.communication.phoneNumber,
        emailAddress: contact.communication.emailAddress,
        attachments: contact.communication.attachments || []
      } : null,
      
      // Related information
      appointmentId: contact.appointmentId,
      insuranceContext: contact.insuranceContext,
      
      // Metadata
      createdBy: contact.createdBy,
      createdAt: contact.createdAt,
      modifiedAt: contact.modifiedAt,
      isActive: contact.isActive
    };
  }

  /**
   * Format contact history list with efficient mapping
   */
  static formatContactHistoryList(contacts: IContactHistory[]): any[] {
    // Use efficient map instead of forEach
    return contacts.map(contact => this.formatContactHistory(contact));
  }

  /**
   * Format contact history with pagination
   */
  static formatContactHistoryResponse(data: {
    contacts: IContactHistory[];
    pagination: any;
  }): any {
    return {
      success: true,
      data: this.formatContactHistoryList(data.contacts),
      pagination: data.pagination,
      meta: {
        total: data.pagination.total,
        page: data.pagination.page,
        hasMore: data.pagination.page < data.pagination.pages
      }
    };
  }

  /**
   * Format contact history statistics for dashboard
   */
  static formatContactHistoryStats(stats: ContactHistoryStats): any {
    return {
      success: true,
      data: {
        overview: {
          totalContacts: stats.totalContacts,
          followUpsRequired: stats.followUpsRequired,
          overdueFollowUps: stats.overdueFollowUps,
          recentActivity: stats.recentActivity,
          averageResponseTime: stats.averageResponseTime
        },
        
        // Contact distribution charts
        distributions: {
          byType: this.formatDistribution(stats.contactsByType),
          byDirection: this.formatDistribution(stats.contactsByDirection),
          byPriority: this.formatDistribution(stats.contactsByPriority)
        },
        
        // Key metrics
        metrics: {
          followUpRate: stats.totalContacts > 0 ? 
            Math.round((stats.followUpsRequired / stats.totalContacts) * 100) : 0,
          overdueRate: stats.followUpsRequired > 0 ? 
            Math.round((stats.overdueFollowUps / stats.followUpsRequired) * 100) : 0,
          activityTrend: stats.recentActivity > 0 ? 'increasing' : 'stable'
        }
      }
    };
  }

  /**
   * Format follow-ups required for task management
   */
  static formatFollowUpsList(followUps: IContactHistory[]): any {
    return {
      success: true,
      data: followUps.map(contact => ({
        id: contact.id,
        clientId: contact.clientId,
        clinicName: contact.clinicName,
        subject: contact.subject,
        priority: contact.priority,
        followUpDate: contact.followUpDate,
        isOverdue: contact.followUpDate ? contact.followUpDate < new Date() : false,
        daysOverdue: contact.followUpDate ? 
          Math.max(0, Math.floor((new Date().getTime() - contact.followUpDate.getTime()) / (1000 * 60 * 60 * 24))) : 0,
        originalContactDate: contact.contactDate,
        contactType: contact.contactType,
        createdBy: contact.createdBy
      })),
      summary: {
        total: followUps.length,
        overdue: followUps.filter(contact => 
          contact.followUpDate && contact.followUpDate < new Date()
        ).length,
        urgent: followUps.filter(contact => contact.priority === 'urgent').length
      }
    };
  }

  /**
   * Format client contact history summary
   */
  static formatClientContactHistory(data: {
    client: any;
    contacts: IContactHistory[];
  }): any {
    const contacts = data.contacts;
    
    return {
      success: true,
      data: {
        client: {
          id: data.client?.clientId,
          name: data.client?.personalInfo?.fullName,
          clinic: data.client?.defaultClinic
        },
        contacts: this.formatContactHistoryList(contacts),
        summary: {
          totalContacts: contacts.length,
          lastContact: contacts.length > 0 ? contacts[0].contactDate : null,
          contactTypes: this.getContactTypeSummary(contacts),
          pendingFollowUps: contacts.filter(c => c.followUpRequired).length
        }
      }
    };
  }

  /**
   * Format recent activity for dashboard
   */
  static formatRecentActivity(contacts: IContactHistory[]): any {
    return {
      success: true,
      data: contacts.map(contact => ({
        id: contact.id,
        type: contact.contactType,
        direction: contact.direction,
        subject: contact.subject,
        clientId: contact.clientId,
        clinicName: contact.clinicName,
        contactDate: contact.contactDate,
        priority: contact.priority,
        createdBy: contact.createdBy,
        hasFollowUp: contact.followUpRequired
      })),
      meta: {
        total: contacts.length,
        timeframe: '7 days'
      }
    };
  }

  /**
   * Format success response with contact data
   */
  static formatSuccess(data: any, message?: string): any {
    return {
      success: true,
      data: Array.isArray(data) ? this.formatContactHistoryList(data) : this.formatContactHistory(data),
      message: message || 'Operation completed successfully'
    };
  }

  /**
   * Format error response
   */
  static formatError(error: string, code?: string): any {
    return {
      success: false,
      error: {
        message: error,
        code: code || 'CONTACT_ERROR'
      }
    };
  }

  /**
   * Format validation error response
   */
  static formatValidationError(errors: string[]): any {
    return {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      }
    };
  }

  /**
   * Private helper methods for data transformation
   */
  
  /**
   * Format distribution data for charts - efficient transformation
   */
  private static formatDistribution(distribution: Record<string, number>): any[] {
    return Object.entries(distribution).map(([key, value]) => ({
      label: this.formatLabel(key),
      value,
      percentage: 0 // Will be calculated on frontend
    }));
  }

  /**
   * Get contact type summary efficiently
   */
  private static getContactTypeSummary(contacts: IContactHistory[]): Record<string, number> {
    return contacts.reduce((acc, contact) => {
      acc[contact.contactType] = (acc[contact.contactType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Format display labels for UI
   */
  private static formatLabel(key: string): string {
    const labelMap: Record<string, string> = {
      'call': 'Phone Call',
      'email': 'Email',
      'sms': 'Text Message',
      'visit': 'In-Person Visit',
      'note': 'Note/Memo',
      'appointment': 'Appointment',
      'other': 'Other',
      'inbound': 'Incoming',
      'outbound': 'Outgoing',
      'internal': 'Internal',
      'low': 'Low Priority',
      'medium': 'Medium Priority',
      'high': 'High Priority',
      'urgent': 'Urgent'
    };
    
    return labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
  }
}
