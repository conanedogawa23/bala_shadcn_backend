import { IAppointment } from '@/models/Appointment';

export class AppointmentView {
  /**
   * Format single appointment for API response
   */
  static formatAppointment(appointment: IAppointment) {
    return {
      success: true,
      data: {
        id: appointment._id,
        appointmentId: (appointment as any).appointmentId,
        type: appointment.type,
        startDate: appointment.startDate,
        endDate: appointment.endDate,
        allDay: appointment.allDay,
        subject: appointment.subject,
        location: appointment.location,
        description: appointment.description,
        status: appointment.status,
        statusText: this.getStatusText(appointment.status),
        label: appointment.label,
        resourceId: appointment.resourceId,
        resourceName: (appointment as any).resourceName,
        duration: appointment.getDurationMinutes(),
        formattedDuration: appointment.getFormattedDuration(),
        
        // Client information
        clientId: appointment.clientId,
        
        // Clinic information
        clinicName: appointment.clinicName,
        
        // Billing information
        billDate: appointment.billDate,
        invoiceDate: appointment.invoiceDate,
        readyToBill: appointment.readyToBill,
        canBeBilled: appointment.canBeBilled(),
        advancedBilling: appointment.advancedBilling,
        advancedBillingId: appointment.advancedBillingId,
        
        // Status helpers
        isCompleted: appointment.isCompleted(),
        isPast: appointment.isPast(),
        isFuture: appointment.isFuture(),
        isToday: appointment.isToday(),
        
        // Metadata
        isActive: appointment.isActive,
        dateCreated: appointment.dateCreated,
        dateModified: appointment.dateModified
      }
    };
  }

  /**
   * Format appointment list with pagination
   */
  static formatAppointmentList(appointments: IAppointment[], page: number, limit: number, total: number) {
    return {
      success: true,
      data: appointments.map(appointment => ({
        id: appointment._id,
        appointmentId: (appointment as any).appointmentId,
        type: appointment.type,
        startDate: appointment.startDate,
        endDate: appointment.endDate,
        subject: appointment.subject,
        status: appointment.status,
        statusText: this.getStatusText(appointment.status),
        resourceId: appointment.resourceId,
        resourceName: (appointment as any).resourceName,
        clientId: appointment.clientId,
        clinicName: appointment.clinicName,
        duration: appointment.getDurationMinutes(),
        formattedDuration: appointment.getFormattedDuration(),
        readyToBill: appointment.readyToBill,
        isCompleted: appointment.isCompleted(),
        isPast: appointment.isPast(),
        isFuture: appointment.isFuture(),
        isToday: appointment.isToday()
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Format appointments ready for billing
   */
  static formatBillingAppointments(appointments: any[]) {
    return {
      success: true,
      data: appointments.map(appointment => ({
        id: appointment._id,
        appointmentId: (appointment as any).appointmentId,
        startDate: appointment.startDate,
        endDate: appointment.endDate,
        subject: appointment.subject,
        clinicName: appointment.clinicName,
        resourceId: appointment.resourceId,
        clientId: appointment.clientId,
        clientInfo: appointment.clientId ? {
          name: appointment.clientId.personalInfo?.firstName + ' ' + appointment.clientId.personalInfo?.lastName,
          insurance: appointment.clientId.insurance?.map((ins: any) => ({
            type: ins.type,
            company: ins.company,
            dpa: ins.dpa
          }))
        } : null,
        billDate: appointment.billDate,
        duration: appointment.getDurationMinutes(),
        amount: this.calculateBillingAmount(appointment)
      })),
      summary: {
        totalAppointments: appointments.length,
        totalAmount: appointments.reduce((sum, apt) => sum + this.calculateBillingAmount(apt), 0),
        appointmentsByClinic: this.groupByClinic(appointments)
      }
    };
  }

  /**
   * Format client appointment history
   */
  static formatClientHistory(history: any) {
    return {
      success: true,
      data: {
        client: history.client,
        appointments: history.appointments.map((appointment: any) => ({
          id: appointment._id,
          appointmentId: (appointment as any).appointmentId,
          startDate: appointment.startDate,
          endDate: appointment.endDate,
          subject: appointment.subject,
          status: appointment.status,
          statusText: this.getStatusText(appointment.status),
          resourceName: (appointment as any).resourceName,
          clinicName: appointment.clinicName,
          duration: appointment.duration,
          formattedDuration: appointment.getFormattedDuration ? appointment.getFormattedDuration() : `${appointment.duration}m`,
          description: appointment.description,
          billDate: appointment.billDate,
          invoiceDate: appointment.invoiceDate
        })),
        summary: {
          totalAppointments: history.appointments.length,
          completedAppointments: history.appointments.filter((apt: any) => apt.status === 1).length,
          cancelledAppointments: history.appointments.filter((apt: any) => apt.status === 2).length,
          upcomingAppointments: history.appointments.filter((apt: any) => 
            apt.status === 0 && new Date(apt.startDate) > new Date()
          ).length
        }
      }
    };
  }

  /**
   * Format appointment statistics
   */
  static formatStats(stats: any) {
    return {
      success: true,
      data: {
        clinic: stats.clinic,
        dateRange: stats.dateRange,
        statistics: {
          ...stats.statistics,
          completionRate: Math.round(stats.statistics.completionRate * 100) / 100,
          cancellationRate: Math.round(stats.statistics.cancellationRate * 100) / 100,
          averageDuration: Math.round(stats.statistics.averageDuration)
        }
      }
    };
  }

  /**
   * Format appointment summary for dashboard
   */
  static formatAppointmentSummary(appointments: IAppointment[]) {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const todayAppointments = appointments.filter(apt => 
      apt.startDate >= todayStart && apt.startDate <= todayEnd
    );

    const upcomingAppointments = appointments.filter(apt => 
      apt.startDate > todayEnd && apt.status === 0
    );

    return {
      success: true,
      data: {
        total: appointments.length,
        today: {
          total: todayAppointments.length,
          completed: todayAppointments.filter(apt => apt.status === 1).length,
          pending: todayAppointments.filter(apt => apt.status === 0).length,
          cancelled: todayAppointments.filter(apt => apt.status === 2).length
        },
        upcoming: {
          total: upcomingAppointments.length,
          nextWeek: upcomingAppointments.filter(apt => {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            return apt.startDate <= nextWeek;
          }).length
        },
        billing: {
          readyToBill: appointments.filter(apt => apt.readyToBill && !apt.invoiceDate).length,
          billed: appointments.filter(apt => apt.invoiceDate).length
        }
      }
    };
  }

  /**
   * Format success response
   */
  static formatSuccess(message: string, data?: any) {
    return {
      success: true,
      message,
      ...(data && { data })
    };
  }

  /**
   * Format error response
   */
  static formatError(message: string, code?: string, details?: any) {
    return {
      success: false,
      error: {
        message,
        code: code || 'APPOINTMENT_ERROR',
        ...(details && { details })
      }
    };
  }

  /**
   * Format validation error response
   */
  static formatValidationError(errors: any[]) {
    return {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.map(error => ({
          field: error.path || error.param,
          message: error.msg,
          value: error.value
        }))
      }
    };
  }

  /**
   * Get status text (private helper)
   */
  private static getStatusText(status: number): string {
    const statusMap: { [key: number]: string } = {
      0: 'Scheduled',
      1: 'Completed',
      2: 'Cancelled',
      3: 'No Show',
      4: 'Rescheduled'
    };
    return statusMap[status] || 'Unknown';
  }

  /**
   * Calculate billing amount (private helper)
   */
  private static calculateBillingAmount(appointment: any): number {
    // This is a placeholder - would be calculated based on service rates
    // and insurance coverage in a real system
    const baseRate = 100; // $100 per hour
    const durationHours = appointment.duration / 60;
    return Math.round(baseRate * durationHours * 100) / 100;
  }

  /**
   * Group appointments by clinic (private helper)
   */
  private static groupByClinic(appointments: any[]): any {
    return appointments.reduce((acc, apt) => {
      const clinic = apt.clinicName;
      if (!acc[clinic]) {
        acc[clinic] = {
          count: 0,
          amount: 0
        };
      }
      acc[clinic].count++;
      acc[clinic].amount += this.calculateBillingAmount(apt);
      return acc;
    }, {});
  }
}
