import request from 'supertest';
import { Express } from 'express';
import { TestSetup, TestHelpers } from '../setup';
import { AppointmentModel } from '@/models/Appointment';
import { ClientModel } from '@/models/Client';
import { ResourceModel } from '@/models/Resource';
import { ClinicModel } from '@/models/Clinic';

// Import app after setup
let app: Express;

describe('AppointmentController', () => {
  let testClients: any[];
  let testResources: any[];
  let testClinics: any[];
  let testAppointments: any[];

  beforeAll(async () => {
    // Import app after database setup
    const { default: appModule } = await import('@/app');
    app = appModule;
  });

  beforeEach(async () => {
    // Create test data efficiently using batch operations
    testClinics = await TestSetup.createTestClinics(2);
    testClients = await TestSetup.createTestClients(5);
    testResources = await TestSetup.createTestResources(3);
    
    const clientIds = testClients.map(client => client.clientId);
    testAppointments = await TestSetup.createTestAppointments(clientIds, 10);
  });

  describe('GET /api/v1/appointments/clinic/:clinicName', () => {
    it('should get appointments by clinic with pagination', async () => {
      const clinicName = testClinics[0].name;
      
      const response = await request(app)
        .get(`/api/v1/appointments/clinic/${clinicName}`)
        .query({
          page: 1,
          limit: 5
        })
        .expect(200);

      // Validate response structure efficiently
      const expectedKeys = ['success', 'data', 'pagination'];
      expect(TestHelpers.validateApiResponse(response.body, expectedKeys)).toBe(true);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 5,
        total: expect.any(Number),
        pages: expect.any(Number)
      });

      // Validate appointment data structure
      if (response.body.data.length > 0) {
        const appointment = response.body.data[0];
        const appointmentKeys = ['id', 'startDate', 'endDate', 'clientId', 'resourceId', 'clinicName', 'status'];
        expect(TestHelpers.validateApiResponse(appointment, appointmentKeys)).toBe(true);
      }
    });

    it('should filter appointments by date range', async () => {
      const clinicName = testClinics[0].name;
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 5);

      const response = await request(app)
        .get(`/api/v1/appointments/clinic/${clinicName}`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify all appointments are within date range
      const appointmentsInRange = response.body.data.every((apt: any) => {
        const aptDate = new Date(apt.startDate);
        return aptDate >= startDate && aptDate <= endDate;
      });
      expect(appointmentsInRange).toBe(true);
    });

    it('should filter appointments by status', async () => {
      const clinicName = testClinics[0].name;
      const targetStatus = 1; // Completed status

      const response = await request(app)
        .get(`/api/v1/appointments/clinic/${clinicName}`)
        .query({ status: targetStatus })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify all appointments have the target status
      const allMatchStatus = response.body.data.every((apt: any) => apt.status === targetStatus);
      expect(allMatchStatus).toBe(true);
    });

    it('should return 404 for non-existent clinic', async () => {
      const response = await request(app)
        .get('/api/v1/appointments/clinic/NonExistentClinic')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/appointments/:id', () => {
    it('should get appointment by ID', async () => {
      const appointment = testAppointments[0];

      const response = await request(app)
        .get(`/api/v1/appointments/${appointment._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(appointment._id.toString());
      expect(response.body.data.clientId).toBe(appointment.clientId);
      expect(response.body.data.resourceId).toBe(appointment.resourceId);
    });

    it('should return 404 for non-existent appointment', async () => {
      const fakeId = '507f1f77bcf86cd799439011'; // Valid ObjectId format

      const response = await request(app)
        .get(`/api/v1/appointments/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid appointment ID format', async () => {
      const response = await request(app)
        .get('/api/v1/appointments/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/appointments', () => {
    it('should create new appointment successfully', async () => {
      const newAppointment = {
        startDate: TestHelpers.generateRandomDate(7).toISOString(),
        endDate: TestHelpers.generateRandomDate(7).toISOString(),
        clientId: testClients[0].clientId,
        resourceId: testResources[0].resourceId,
        clinicName: testClinics[0].name,
        subject: 'Test Appointment Creation',
        duration: 60,
        type: 0,
        status: 0,
        label: 1
      };

      // Ensure endDate is after startDate
      const start = new Date(newAppointment.startDate);
      const end = new Date(start);
      end.setHours(start.getHours() + 1);
      newAppointment.endDate = end.toISOString();

      const response = await request(app)
        .post('/api/v1/appointments')
        .send(newAppointment)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.clientId).toBe(newAppointment.clientId);
      expect(response.body.data.resourceId).toBe(newAppointment.resourceId);
      expect(response.body.data.subject).toBe(newAppointment.subject);

      // Verify appointment was saved to database
      const savedAppointment = await AppointmentModel.findById(response.body.data.id);
      expect(savedAppointment).toBeTruthy();
      expect(savedAppointment?.clientId).toBe(newAppointment.clientId);
    });

    it('should detect time slot conflicts', async () => {
      const existingAppointment = testAppointments[0];
      
      const conflictingAppointment = {
        startDate: existingAppointment.startDate.toISOString(),
        endDate: existingAppointment.endDate.toISOString(),
        clientId: testClients[1].clientId, // Different client
        resourceId: existingAppointment.resourceId, // Same resource
        clinicName: existingAppointment.clinicName,
        subject: 'Conflicting Appointment'
      };

      const response = await request(app)
        .post('/api/v1/appointments')
        .send(conflictingAppointment)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
      expect(response.body.error.message).toContain('Time slot conflict');
    });

    it('should validate required fields', async () => {
      const incompleteAppointment = {
        startDate: new Date().toISOString(),
        // Missing required fields: endDate, clientId, resourceId, clinicName
      };

      const response = await request(app)
        .post('/api/v1/appointments')
        .send(incompleteAppointment)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeInstanceOf(Array);
      expect(response.body.error.details.length).toBeGreaterThan(0);
    });

    it('should validate resource availability', async () => {
      // Create a resource that's not available on weekends
      const resource = await ResourceModel.findById(testResources[0]._id);
      if (resource) {
        resource.availability.saturday.available = false;
        resource.availability.sunday.available = false;
        await resource.save();
      }

      // Try to book on a Saturday
      const saturday = new Date();
      saturday.setDate(saturday.getDate() + (6 - saturday.getDay())); // Next Saturday
      const saturdayEnd = new Date(saturday);
      saturdayEnd.setHours(saturday.getHours() + 1);

      const weekendAppointment = {
        startDate: saturday.toISOString(),
        endDate: saturdayEnd.toISOString(),
        clientId: testClients[0].clientId,
        resourceId: testResources[0].resourceId,
        clinicName: testClinics[0].name,
        subject: 'Weekend Appointment'
      };

      const response = await request(app)
        .post('/api/v1/appointments')
        .send(weekendAppointment)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not available');
    });
  });

  describe('PUT /api/v1/appointments/:id', () => {
    it('should update appointment successfully', async () => {
      const appointment = testAppointments[0];
      const updateData = {
        subject: 'Updated Appointment Subject',
        description: 'Updated description',
        duration: 90
      };

      const response = await request(app)
        .put(`/api/v1/appointments/${appointment._id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subject).toBe(updateData.subject);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.duration).toBe(updateData.duration);

      // Verify database was updated
      const updatedAppointment = await AppointmentModel.findById(appointment._id);
      expect(updatedAppointment?.subject).toBe(updateData.subject);
    });

    it('should detect conflicts when updating time', async () => {
      const appointment1 = testAppointments[0];
      const appointment2 = testAppointments[1];

      // Try to update appointment1 to overlap with appointment2 (same resource)
      if (appointment1.resourceId !== appointment2.resourceId) {
        appointment1.resourceId = appointment2.resourceId;
        await appointment1.save();
      }

      const updateData = {
        startDate: appointment2.startDate.toISOString(),
        endDate: appointment2.endDate.toISOString()
      };

      const response = await request(app)
        .put(`/api/v1/appointments/${appointment1._id}`)
        .send(updateData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
    });
  });

  describe('DELETE /api/v1/appointments/:id/cancel', () => {
    it('should cancel appointment successfully', async () => {
      const appointment = testAppointments[0];
      const cancelReason = 'Client requested cancellation';

      const response = await request(app)
        .delete(`/api/v1/appointments/${appointment._id}/cancel`)
        .send({ reason: cancelReason })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cancelled successfully');

      // Verify appointment was marked as cancelled in database
      const cancelledAppointment = await AppointmentModel.findById(appointment._id);
      expect(cancelledAppointment?.isActive).toBe(false);
      expect(cancelledAppointment?.status).toBe(2); // Cancelled status
      expect(cancelledAppointment?.description).toContain(cancelReason);
    });
  });

  describe('PUT /api/v1/appointments/:id/complete', () => {
    it('should complete appointment and mark ready for billing', async () => {
      const appointment = testAppointments[0];
      const completionNotes = 'Session completed successfully';

      const response = await request(app)
        .put(`/api/v1/appointments/${appointment._id}/complete`)
        .send({ notes: completionNotes })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isCompleted).toBe(true);
      expect(response.body.data.readyToBill).toBe(true);
      expect(response.body.data.canBeBilled).toBe(true);

      // Verify database was updated
      const completedAppointment = await AppointmentModel.findById(appointment._id);
      expect(completedAppointment?.status).toBe(1); // Completed status
      expect(completedAppointment?.readyToBill).toBe(true);
      expect(completedAppointment?.billDate).toBeTruthy();
      expect(completedAppointment?.description).toContain(completionNotes);
    });

    it('should not allow completing already completed appointment', async () => {
      const appointment = testAppointments[0];
      
      // First completion
      await request(app)
        .put(`/api/v1/appointments/${appointment._id}/complete`)
        .send({ notes: 'First completion' })
        .expect(200);

      // Second completion attempt
      const response = await request(app)
        .put(`/api/v1/appointments/${appointment._id}/complete`)
        .send({ notes: 'Second completion' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('already completed');
    });
  });

  describe('GET /api/v1/appointments/billing/ready', () => {
    it('should get appointments ready for billing', async () => {
      // Mark some appointments as ready for billing
      const appointmentsToMarkReady = testAppointments.slice(0, 3);
      await Promise.all(
        appointmentsToMarkReady.map(async (apt) => {
          apt.status = 1; // Completed
          apt.readyToBill = true;
          apt.billDate = new Date();
          return apt.save();
        })
      );

      const response = await request(app)
        .get('/api/v1/appointments/billing/ready')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.summary).toMatchObject({
        totalAppointments: expect.any(Number),
        totalAmount: expect.any(Number)
      });

      // Verify all returned appointments are ready for billing
      const allReadyForBilling = response.body.data.every((apt: any) => 
        apt.readyToBill && !apt.invoiceDate
      );
      expect(allReadyForBilling).toBe(true);
    });

    it('should filter billing appointments by clinic', async () => {
      const clinicName = testClinics[0].name;
      
      const response = await request(app)
        .get('/api/v1/appointments/billing/ready')
        .query({ clinicName })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify all appointments belong to specified clinic
      const allFromClinic = response.body.data.every((apt: any) => 
        apt.clinicName === clinicName
      );
      expect(allFromClinic).toBe(true);
    });
  });

  describe('GET /api/v1/appointments/resource/:resourceId/schedule', () => {
    it('should get resource schedule for specific date', async () => {
      const resourceId = testResources[0].resourceId;
      const date = new Date().toISOString().split('T')[0]; // Today's date

      const response = await request(app)
        .get(`/api/v1/appointments/resource/${resourceId}/schedule`)
        .query({ date })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resource.id).toBe(resourceId);
      expect(response.body.data.date).toBe(date);
      expect(response.body.data.availability).toBeTruthy();
      expect(response.body.data.appointments).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/appointments/client/:clientId/history', () => {
    it('should get client appointment history', async () => {
      const clientId = testClients[0].clientId;

      const response = await request(app)
        .get(`/api/v1/appointments/client/${clientId}/history`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.client.id).toBe(clientId);
      expect(response.body.data.appointments).toBeInstanceOf(Array);
      expect(response.body.data.summary).toMatchObject({
        totalAppointments: expect.any(Number),
        completedAppointments: expect.any(Number),
        cancelledAppointments: expect.any(Number),
        upcomingAppointments: expect.any(Number)
      });

      // Verify all appointments belong to the client
      const allClientAppointments = response.body.data.appointments.every((apt: any) => 
        apt.clientId === clientId
      );
      expect(allClientAppointments).toBe(true);
    });
  });

  describe('GET /api/v1/appointments/clinic/:clinicName/stats', () => {
    it('should get clinic appointment statistics', async () => {
      const clinicName = testClinics[0].name;

      const response = await request(app)
        .get(`/api/v1/appointments/clinic/${clinicName}/stats`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.clinic.name).toBe(clinicName);
      expect(response.body.data.statistics).toMatchObject({
        totalAppointments: expect.any(Number),
        completedAppointments: expect.any(Number),
        cancelledAppointments: expect.any(Number),
        pendingAppointments: expect.any(Number),
        completionRate: expect.any(Number),
        cancellationRate: expect.any(Number),
        averageDuration: expect.any(Number)
      });
    });

    it('should filter statistics by date range', async () => {
      const clinicName = testClinics[0].name;
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const response = await request(app)
        .get(`/api/v1/appointments/clinic/${clinicName}/stats`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dateRange).toMatchObject({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Force a database error by using invalid data
      const response = await request(app)
        .post('/api/v1/appointments')
        .send({
          startDate: 'invalid-date',
          endDate: 'invalid-date',
          clientId: 'invalid-client',
          resourceId: 'invalid-resource',
          clinicName: 'invalid-clinic'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeTruthy();
    });

    it('should validate pagination parameters', async () => {
      const clinicName = testClinics[0].name;
      
      const response = await request(app)
        .get(`/api/v1/appointments/clinic/${clinicName}`)
        .query({
          page: -1,
          limit: 101
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
