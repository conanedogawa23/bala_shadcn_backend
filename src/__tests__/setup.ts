import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { logger } from '@/utils/logger';

let mongoServer: MongoMemoryServer;

/**
 * Test setup with optimized database management
 * Avoids forEach patterns for better performance
 */
export class TestSetup {
  /**
   * Setup in-memory MongoDB for testing
   */
  static async setupDatabase(): Promise<void> {
    try {
      // Create in-memory MongoDB instance
      mongoServer = await MongoMemoryServer.create({
        binary: {
          version: '6.0.0',
          skipMD5: true
        },
        instance: {
          dbName: 'test_visio_db'
        }
      });

      const mongoUri = mongoServer.getUri();
      
      // Connect mongoose to test database
      await mongoose.connect(mongoUri, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
      });

      logger.info('Test database connected successfully');
    } catch (error) {
      logger.error('Failed to setup test database:', error);
      throw error;
    }
  }

  /**
   * Clean up database collections efficiently
   */
  static async cleanDatabase(): Promise<void> {
    try {
      if (mongoose.connection.readyState === 1) {
        // Get all collection names efficiently
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(collection => collection.name);
        
        // Use Promise.all for parallel cleanup instead of forEach
        await Promise.all(
          collectionNames.map(name => mongoose.connection.db.collection(name).deleteMany({}))
        );
      }
    } catch (error) {
      logger.error('Failed to clean test database:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  static async closeDatabase(): Promise<void> {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      
      if (mongoServer) {
        await mongoServer.stop();
      }
      
      logger.info('Test database closed successfully');
    } catch (error) {
      logger.error('Failed to close test database:', error);
      throw error;
    }
  }

  /**
   * Create test data efficiently using bulk operations
   */
  static async createTestClients(count: number = 10): Promise<any[]> {
    const { ClientModel } = await import('@/models/Client');
    
    // Generate test data efficiently using map instead of forEach
    const testClients = Array.from({ length: count }, (_, index) => ({
      clientId: `TEST_CLIENT_${index + 1}`,
      clientKey: index + 1,
      personalInfo: {
        firstName: `TestFirst${index + 1}`,
        lastName: `TestLast${index + 1}`,
        fullName: `TestLast${index + 1}, TestFirst${index + 1}`,
        fullNameForAutocomplete: `TestLast${index + 1}, TestFirst${index + 1}`,
        birthday: {
          day: '15',
          month: '06',
          year: '1990'
        },
        gender: index % 2 === 0 ? 'Male' : 'Female'
      },
      contact: {
        address: {
          street: `123 Test Street ${index + 1}`,
          city: 'Toronto',
          province: 'ON',
          postalCode: {
            first3: 'M5V',
            last3: '3A8',
            full: 'M5V 3A8'
          }
        },
        phones: {
          home: {
            countryCode: '1',
            areaCode: '416',
            number: `555${String(index + 1).padStart(4, '0')}`,
            full: `(416) 555${String(index + 1).padStart(4, '0')}`
          }
        },
        email: `test${index + 1}@example.com`
      },
      medical: {
        familyMD: 'Dr. Test',
        csrName: 'Test CSR'
      },
      insurance: [],
      clinics: ['TestClinic'],
      defaultClinic: 'TestClinic',
      isActive: true,
      dateCreated: new Date(),
      referralType: 0,
      referralSubtype: 0
    }));

    // Use insertMany for optimal performance
    const result = await ClientModel.insertMany(testClients);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Create test appointments efficiently
   */
  static async createTestAppointments(clientIds: string[], count: number = 5): Promise<any[]> {
    const { AppointmentModel } = await import('@/models/Appointment');
    
    const baseDate = new Date();
    
    // Generate appointments efficiently
    const testAppointments = Array.from({ length: count }, (_, index) => {
      const startDate = new Date(baseDate);
      startDate.setDate(startDate.getDate() + index);
      startDate.setHours(9 + index, 0, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1);
      
      return {
        type: 0,
        startDate,
        endDate,
        subject: `Test Appointment ${index + 1}`,
        status: index % 3, // Vary status: 0, 1, 2
        label: index % 4,  // Vary labels: 0, 1, 2, 3
        resourceId: (index % 3) + 1, // Cycle through resources 1, 2, 3
        duration: 60,
        clientId: clientIds[index % clientIds.length],
        clinicName: 'TestClinic',
        readyToBill: index % 2 === 0,
        advancedBilling: false,
        isActive: true
      };
    });

    const result = await AppointmentModel.insertMany(testAppointments);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Create test resources efficiently
   */
  static async createTestResources(count: number = 5): Promise<any[]> {
    const { ResourceModel } = await import('@/models/Resource');
    
    const resourceTypes = ['practitioner', 'service', 'equipment', 'room'];
    
    const testResources = Array.from({ length: count }, (_, index) => {
      const type = resourceTypes[index % resourceTypes.length];
      
      const baseResource = {
        resourceId: index + 1,
        resourceName: `Test ${type} ${index + 1}`,
        type,
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        clinics: ['TestClinic'],
        defaultClinic: 'TestClinic',
        isActive: true,
        isBookable: true,
        requiresApproval: false,
        availability: {
          monday: { start: '09:00', end: '17:00', available: true },
          tuesday: { start: '09:00', end: '17:00', available: true },
          wednesday: { start: '09:00', end: '17:00', available: true },
          thursday: { start: '09:00', end: '17:00', available: true },
          friday: { start: '09:00', end: '17:00', available: true },
          saturday: { start: '09:00', end: '17:00', available: false },
          sunday: { start: '09:00', end: '17:00', available: false }
        },
        stats: {
          totalAppointments: 0,
          averageDuration: 60,
          lastActivity: new Date()
        }
      };

      // Add type-specific data
      if (type === 'practitioner') {
        return {
          ...baseResource,
          practitioner: {
            firstName: `TestPractitioner${index + 1}`,
            lastName: 'Smith',
            credentials: 'RMT',
            specialties: ['Massage', 'Physiotherapy'][index % 2] ? ['Massage'] : ['Physiotherapy'],
            email: `practitioner${index + 1}@test.com`,
            phone: '(416) 555-0100'
          }
        };
      }

      if (type === 'service') {
        return {
          ...baseResource,
          service: {
            category: ['Massage', 'Physiotherapy', 'Facial'][index % 3],
            duration: [30, 45, 60, 90][index % 4],
            price: [75, 100, 125, 150][index % 4],
            description: `Test service description ${index + 1}`,
            requiresEquipment: []
          }
        };
      }

      return baseResource;
    });

    const result = await ResourceModel.insertMany(testResources);
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Create test clinics efficiently
   */
  static async createTestClinics(count: number = 3): Promise<any[]> {
    const { ClinicModel } = await import('@/models/Clinic');
    
    const testClinics = Array.from({ length: count }, (_, index) => ({
      clinicId: `TEST_CLINIC_${index + 1}`,
      name: `TestClinic${index + 1}`,
      displayName: `Test Clinic ${index + 1}`,
      completeName: `Test Clinic ${index + 1} - Complete`,
      address: {
        street: `456 Clinic Street ${index + 1}`,
        city: 'Toronto',
        province: 'ON',
        postalCode: {
          first3: 'M4W',
          last3: '1A8',
          full: 'M4W 1A8'
        }
      },
      contact: {
        phone: '(416) 555-0200',
        fax: '(416) 555-0201',
        email: `clinic${index + 1}@test.com`
      },
      services: ['Massage', 'Physiotherapy', 'Facial'],
      status: 'active',
      isActive: true,
      clientCount: 0,
      stats: {
        totalClients: 0,
        activeClients: 0,
        appointmentsThisMonth: 0,
        revenue: 0
      }
    }));

    const result = await ClinicModel.insertMany(testClinics);
    return Array.isArray(result) ? result : [result];
  }
}

/**
 * Test utilities for making HTTP requests
 */
export class TestHelpers {
  /**
   * Create authorization headers for testing
   */
  static createAuthHeaders(token?: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  /**
   * Generate random test data efficiently
   */
  static generateRandomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  }

  /**
   * Generate random date within range
   */
  static generateRandomDate(daysFromNow: number = 30): Date {
    const now = new Date();
    const randomDays = Math.floor(Math.random() * daysFromNow);
    const randomDate = new Date(now);
    randomDate.setDate(now.getDate() + randomDays);
    return randomDate;
  }

  /**
   * Validate API response structure
   */
  static validateApiResponse(response: any, expectedKeys: string[]): boolean {
    return expectedKeys.every(key => key in response);
  }

  /**
   * Compare arrays efficiently without forEach
   */
  static arraysEqual<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((value, index) => value === arr2[index]);
  }
}

// Global test setup
beforeAll(async () => {
  await TestSetup.setupDatabase();
});

beforeEach(async () => {
  await TestSetup.cleanDatabase();
});

afterAll(async () => {
  await TestSetup.closeDatabase();
});
