import { IEvent } from '../models/Event';

export interface EventResponse {
  id: string;
  eventId: number;
  parentEventId?: number;
  userId?: number;
  categoryId?: number;
  title: string;
  description?: string;
  eventDate: string;
  eventTime?: string;
  eventTimeEnd?: string;
  duration: number; // in minutes
  formattedDuration: string;
  location?: string;
  cost?: string;
  url?: string;
  isPublic: boolean;
  isApproved: boolean;
  isUpcoming: boolean;
  isPast: boolean;
  isToday: boolean;
  customFields: {
    textBox1?: string;
    textBox2?: string;
    textBox3?: string;
    textArea1?: string;
    textArea2?: string;
    textArea3?: string;
    checkBox1?: boolean;
    checkBox2?: boolean;
    checkBox3?: boolean;
  };
  client?: {
    id?: string;
    fullName?: string;
    clinicName?: string;
  };
  dateAdded: string;
  userAdded?: number;
  dateCreated: string;
  dateModified: string;
}

export interface EventListResponse {
  events: EventResponse[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export interface EventStatsResponse {
  totalEvents: number;
  upcomingEvents: number;
  publicEvents: number;
  pendingApproval: number;
  eventsWithClients: number;
  categoriesCount: number;
  topCategories: Array<{ categoryId: number; count: number }>;
  topClinics: Array<{ clinic: string; count: number }>;
}

export class EventView {
  /**
   * Format single event for response
   */
  static formatEvent(event: IEvent): EventResponse {
    // Calculate durations and status
    const duration = this.calculateDuration(event);
    const formattedDuration = this.formatDuration(duration);
    const isUpcoming = this.isUpcoming(event);
    const isPast = this.isPast(event);
    const isToday = this.isToday(event);

    return {
      id: event._id.toString(),
      eventId: event.eventId,
      parentEventId: event.parentEventId,
      userId: event.userId,
      categoryId: event.categoryId,
      title: event.title?.trim() || '',
      description: event.description?.trim(),
      eventDate: event.eventDate.toISOString(),
      eventTime: event.eventTime?.toISOString(),
      eventTimeEnd: event.eventTimeEnd?.toISOString(),
      duration,
      formattedDuration,
      location: event.location?.trim(),
      cost: event.cost?.trim(),
      url: event.url?.trim(),
      isPublic: event.isPublic,
      isApproved: event.isApproved,
      isUpcoming,
      isPast,
      isToday,
      customFields: {
        textBox1: event.customTextBox1?.trim(),
        textBox2: event.customTextBox2?.trim(),
        textBox3: event.customTextBox3?.trim(),
        textArea1: event.customTextArea1?.trim(),
        textArea2: event.customTextArea2?.trim(),
        textArea3: event.customTextArea3?.trim(),
        checkBox1: event.customCheckBox1,
        checkBox2: event.customCheckBox2,
        checkBox3: event.customCheckBox3
      },
      client: event.clientId ? {
        id: event.clientId.trim(),
        fullName: event.clientFullName?.trim(),
        clinicName: event.clientClinicName?.trim()
      } : undefined,
      dateAdded: event.dateAdded.toISOString(),
      userAdded: event.userAdded,
      dateCreated: event.dateCreated.toISOString(),
      dateModified: event.dateModified.toISOString()
    };
  }

  /**
   * Format multiple events for response
   */
  static formatEvents(events: IEvent[]): EventResponse[] {
    return events.map(event => this.formatEvent(event));
  }

  /**
   * Format event list with pagination
   */
  static formatEventList(data: {
    events: IEvent[];
    total: number;
    page: number;
    totalPages: number;
    limit?: number;
  }): EventListResponse {
    return {
      events: this.formatEvents(data.events),
      pagination: {
        total: data.total,
        page: data.page,
        totalPages: data.totalPages,
        limit: data.limit || 50
      }
    };
  }

  /**
   * Format event statistics
   */
  static formatEventStats(stats: {
    totalEvents: number;
    upcomingEvents: number;
    publicEvents: number;
    pendingApproval: number;
    eventsWithClients: number;
    categoriesCount: number;
    topCategories: Array<{ categoryId: number; count: number }>;
    topClinics: Array<{ clinic: string; count: number }>;
  }): EventStatsResponse {
    return {
      totalEvents: stats.totalEvents,
      upcomingEvents: stats.upcomingEvents,
      publicEvents: stats.publicEvents,
      pendingApproval: stats.pendingApproval,
      eventsWithClients: stats.eventsWithClients,
      categoriesCount: stats.categoriesCount,
      topCategories: stats.topCategories,
      topClinics: stats.topClinics.map(item => ({
        clinic: item.clinic?.trim() || 'Unknown',
        count: item.count
      }))
    };
  }

  /**
   * Format for calendar view
   */
  static formatEventForCalendar(event: IEvent): {
    id: string;
    title: string;
    start: string;
    end?: string;
    allDay: boolean;
    description?: string;
    location?: string;
    color?: string;
    extendedProps: {
      eventId: number;
      isApproved: boolean;
      isPublic: boolean;
      client?: {
        id?: string;
        name?: string;
        clinic?: string;
      };
      cost?: string;
      url?: string;
    };
  } {
    return {
      id: event._id.toString(),
      title: event.title?.trim() || 'Untitled Event',
      start: event.eventTime?.toISOString() || event.eventDate.toISOString(),
      end: event.eventTimeEnd?.toISOString(),
      allDay: !event.eventTime, // If no specific time, treat as all-day
      description: event.description?.trim(),
      location: event.location?.trim(),
      color: this.getEventColor(event),
      extendedProps: {
        eventId: event.eventId,
        isApproved: event.isApproved,
        isPublic: event.isPublic,
        client: event.clientId ? {
          id: event.clientId.trim(),
          name: event.clientFullName?.trim(),
          clinic: event.clientClinicName?.trim()
        } : undefined,
        cost: event.cost?.trim(),
        url: event.url?.trim()
      }
    };
  }

  /**
   * Format multiple events for calendar view
   */
  static formatEventsForCalendar(events: IEvent[]): Array<ReturnType<typeof EventView.formatEventForCalendar>> {
    return events.map(event => this.formatEventForCalendar(event));
  }

  /**
   * Format for frontend compatibility (if needed for mock data replacement)
   */
  static formatEventForFrontend(event: IEvent): any {
    return {
      id: event._id.toString(),
      eventId: event.eventId,
      title: event.title?.trim() || '',
      description: event.description?.trim(),
      date: event.eventDate.toISOString().split('T')[0], // YYYY-MM-DD format
      time: event.eventTime ? this.formatTime(event.eventTime) : null,
      endTime: event.eventTimeEnd ? this.formatTime(event.eventTimeEnd) : null,
      duration: this.formatDuration(this.calculateDuration(event)),
      location: event.location?.trim(),
      cost: event.cost?.trim(),
      url: event.url?.trim(),
      status: {
        isPublic: event.isPublic,
        isApproved: event.isApproved,
        isUpcoming: this.isUpcoming(event),
        isPast: this.isPast(event)
      },
      client: event.clientId ? {
        id: event.clientId.trim(),
        name: event.clientFullName?.trim(),
        clinic: event.clientClinicName?.trim()
      } : null,
      category: event.categoryId,
      customData: {
        text1: event.customTextBox1?.trim(),
        text2: event.customTextBox2?.trim(),
        text3: event.customTextBox3?.trim(),
        area1: event.customTextArea1?.trim(),
        area2: event.customTextArea2?.trim(),
        area3: event.customTextArea3?.trim(),
        flag1: event.customCheckBox1,
        flag2: event.customCheckBox2,
        flag3: event.customCheckBox3
      },
      created: event.dateCreated.toISOString(),
      updated: event.dateModified.toISOString()
    };
  }

  /**
   * Format multiple events for frontend compatibility
   */
  static formatEventsForFrontend(events: IEvent[]): any[] {
    return events.map(event => this.formatEventForFrontend(event));
  }

  /**
   * Format search results
   */
  static formatSearchResults(events: IEvent[], searchTerm: string): {
    results: EventResponse[];
    searchTerm: string;
    count: number;
  } {
    return {
      results: this.formatEvents(events),
      searchTerm: searchTerm.trim(),
      count: events.length
    };
  }

  /**
   * Format client events group
   */
  static formatClientEvents(clientId: string, events: IEvent[]): {
    clientId: string;
    clientName?: string;
    events: EventResponse[];
    count: number;
  } {
    const clientName = events.length > 0 ? events[0].clientFullName : undefined;
    
    return {
      clientId: clientId.trim(),
      clientName: clientName?.trim(),
      events: this.formatEvents(events),
      count: events.length
    };
  }

  /**
   * Calculate event duration in minutes
   */
  private static calculateDuration(event: IEvent): number {
    if (event.eventTime && event.eventTimeEnd) {
      const start = new Date(event.eventTime);
      const end = new Date(event.eventTimeEnd);
      return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }
    return 0;
  }

  /**
   * Format duration in human-readable format
   */
  private static formatDuration(minutes: number): string {
    if (minutes <= 0) {return 'Duration not specified';}
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Check if event is upcoming
   */
  private static isUpcoming(event: IEvent): boolean {
    const eventDateTime = event.eventTime || event.eventDate;
    return new Date(eventDateTime) > new Date();
  }

  /**
   * Check if event is past
   */
  private static isPast(event: IEvent): boolean {
    const eventDateTime = event.eventTimeEnd || event.eventTime || event.eventDate;
    return new Date(eventDateTime) < new Date();
  }

  /**
   * Check if event is today
   */
  private static isToday(event: IEvent): boolean {
    const today = new Date();
    const eventDate = new Date(event.eventDate);
    
    return today.getFullYear() === eventDate.getFullYear() &&
           today.getMonth() === eventDate.getMonth() &&
           today.getDate() === eventDate.getDate();
  }

  /**
   * Get event color based on status and properties
   */
  private static getEventColor(event: IEvent): string {
    if (!event.isApproved) {return '#ff9800';} // Orange for pending approval
    if (!event.isPublic) {return '#2196f3';} // Blue for private events
    if (event.clientId) {return '#4caf50';} // Green for client events
    return '#9c27b0'; // Purple for general public events
  }

  /**
   * Format time for display (HH:MM format)
   */
  private static formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
}
