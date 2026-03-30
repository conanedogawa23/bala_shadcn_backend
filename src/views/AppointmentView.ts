export class AppointmentView {

  private static getDurationMinutes(appointment: any): number {
    if (appointment.duration > 0) {return appointment.duration;}
    const start = new Date(appointment.startDate);
    const end = new Date(appointment.endDate);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  private static getFormattedDuration(appointment: any): string {
    const minutes = this.getDurationMinutes(appointment);
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return hours > 0 ? `${hours}h ${remaining}m` : `${minutes}m`;
  }

  private static isCompleted(appointment: any): boolean {
    return appointment.status === 1;
  }

  private static isPast(appointment: any): boolean {
    return new Date(appointment.endDate) < new Date();
  }

  private static isFuture(appointment: any): boolean {
    return new Date(appointment.startDate) > new Date();
  }

  private static isToday(appointment: any): boolean {
    const today = new Date();
    const aptDate = new Date(appointment.startDate);
    return today.getFullYear() === aptDate.getFullYear() &&
           today.getMonth() === aptDate.getMonth() &&
           today.getDate() === aptDate.getDate();
  }

  private static canBeBilled(appointment: any): boolean {
    return this.isCompleted(appointment) && appointment.readyToBill && !appointment.invoiceDate;
  }

  /**
   * Extract client info from the $lookup-joined clientDetails subdocument.
   */
  private static buildClientInfo(appointment: any) {
    const cd = appointment.clientDetails;
    if (!cd) {return null;}

    const firstName = cd.personalInfo?.firstName || '';
    const lastName = cd.personalInfo?.lastName || '';
    const fullName = cd.personalInfo?.fullName || `${lastName}, ${firstName}`.trim();
    const email = cd.contact?.email || '';
    const phone = cd.contact?.phones?.cell?.full
      || cd.contact?.phones?.home?.full
      || cd.contact?.phones?.work?.full
      || '';

    return {
      id: cd.clientId,
      clientKey: cd.clientKey,
      firstName,
      lastName,
      name: fullName,
      email: email !== 'none@dmo.com' ? email : '',
      phone
    };
  }

  /**
   * Format single appointment for API response
   */
  static formatAppointment(appointment: any) {
    return {
      success: true,
      data: {
        id: appointment._id,
        appointmentId: appointment.appointmentId,
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
        resourceName: appointment.resourceName,
        referringDoctorId: appointment.referringDoctorId,
        referringDoctorName: appointment.referringDoctorName,
        duration: this.getDurationMinutes(appointment),
        formattedDuration: this.getFormattedDuration(appointment),

        clientId: appointment.clientId,
        clientInfo: this.buildClientInfo(appointment),

        clinicName: appointment.clinicName,

        billDate: appointment.billDate,
        invoiceDate: appointment.invoiceDate,
        readyToBill: appointment.readyToBill,
        canBeBilled: this.canBeBilled(appointment),
        advancedBilling: appointment.advancedBilling,
        advancedBillingId: appointment.advancedBillingId,

        isCompleted: this.isCompleted(appointment),
        isPast: this.isPast(appointment),
        isFuture: this.isFuture(appointment),
        isToday: this.isToday(appointment),

        isActive: appointment.isActive,
        dateCreated: appointment.dateCreated,
        dateModified: appointment.dateModified
      }
    };
  }

  /**
   * Format appointment list with pagination
   */
  static formatAppointmentList(appointments: any[], page: number, limit: number, total: number) {
    return {
      success: true,
      data: appointments.map(appointment => ({
        id: appointment._id,
        appointmentId: appointment.appointmentId,
        type: appointment.type,
        startDate: appointment.startDate,
        endDate: appointment.endDate,
        subject: appointment.subject,
        status: appointment.status,
        statusText: this.getStatusText(appointment.status),
        resourceId: appointment.resourceId,
        resourceName: appointment.resourceName,
        referringDoctorId: appointment.referringDoctorId,
        referringDoctorName: appointment.referringDoctorName,
        clientId: appointment.clientId,
        clientName: this.buildClientInfo(appointment)?.name || appointment.subject,
        clientInfo: this.buildClientInfo(appointment),
        clinicName: appointment.clinicName,
        duration: this.getDurationMinutes(appointment),
        formattedDuration: this.getFormattedDuration(appointment),
        readyToBill: appointment.readyToBill,
        isCompleted: this.isCompleted(appointment),
        isPast: this.isPast(appointment),
        isFuture: this.isFuture(appointment),
        isToday: this.isToday(appointment)
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
   * Format appointments ready for billing with client info from aggregation $lookup.
   */
  static formatBillingAppointments(appointments: any[]) {
    return {
      success: true,
      data: appointments.map(appointment => ({
        id: appointment._id,
        appointmentId: appointment.appointmentId,
        startDate: appointment.startDate,
        endDate: appointment.endDate,
        subject: appointment.subject,
        clinicName: appointment.clinicName,
        resourceId: appointment.resourceId,
        resourceName: appointment.resourceName,
        referringDoctorId: appointment.referringDoctorId,
        referringDoctorName: appointment.referringDoctorName,
        clientId: appointment.clientId,
        clientInfo: this.buildClientInfo(appointment) || {
          name: appointment.subject,
          insurance: []
        },
        billDate: appointment.billDate,
        duration: this.getDurationMinutes(appointment),
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
          appointmentId: appointment.appointmentId,
          startDate: appointment.startDate,
          endDate: appointment.endDate,
          subject: appointment.subject,
          status: appointment.status,
          statusText: this.getStatusText(appointment.status),
          resourceName: appointment.resourceName,
          referringDoctorName: appointment.referringDoctorName,
          clinicName: appointment.clinicName,
          duration: appointment.duration,
          formattedDuration: this.getFormattedDuration(appointment),
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
  static formatAppointmentSummary(appointments: any[]) {
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
