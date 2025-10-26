# Technical Implementation Guide: Closing Feature Gaps

**Purpose:** Provide actionable technical guidance for implementing missing features  
**Target Audience:** Development Team  
**Priority:** CRITICAL - Required for Production Release

---

## 1. CRITICAL: Calendar/Appointment Scheduler Implementation

### Current State
- ❌ No calendar view
- ❌ List view only with authentication errors
- ❌ No time-slot scheduling

### Required Features
Based on the original application, the scheduler must support:

1. **Multiple View Modes**
   - Day view (hourly slots 8 AM - 7 PM)
   - Work Week view (5 days)
   - Week view (7 days)
   - Month view (calendar grid)
   - Timeline view (resource-based)

2. **Resource Management**
   - Therapist/Practitioner scheduling
   - Room/Equipment scheduling
   - Multiple resources visible simultaneously
   - Resource filtering and selection

3. **Time Slot Features**
   - 15-minute interval granularity
   - Visual appointment blocks
   - Color coding by status/type
   - Drag-and-drop rescheduling
   - Click to create appointment

4. **Navigation**
   - Previous/Next buttons
   - Today button
   - Date picker
   - First/Last page navigation
   - +/- resource visibility controls

### Recommended Solution

#### Option A: React Big Calendar (Recommended)
**Pros:**
- Native React component
- Good Next.js integration
- Drag-and-drop support
- Resource timeline view
- Active maintenance

**Installation:**
```bash
npm install react-big-calendar moment
npm install @types/react-big-calendar --save-dev
```

**Implementation Example:**
```typescript
// app/clinic/[clinic]/appointments/calendar/page.tsx
'use client'

import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = momentLocalizer(moment)

export default function AppointmentCalendar() {
  const [view, setView] = useState(Views.DAY)
  const [date, setDate] = useState(new Date())
  const [appointments, setAppointments] = useState([])

  // Fetch appointments from API
  useEffect(() => {
    fetchAppointments()
  }, [date, view])

  const eventStyleGetter = (event) => {
    const backgroundColor = event.status === 'confirmed' ? '#3174ad' : '#f4a261'
    return { style: { backgroundColor } }
  }

  return (
    <div className="h-[calc(100vh-200px)]">
      <Calendar
        localizer={localizer}
        events={appointments}
        startAccessor="start"
        endAccessor="end"
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        views={[Views.DAY, Views.WEEK, Views.WORK_WEEK, Views.MONTH]}
        step={15}
        timeslots={4}
        min={new Date(0, 0, 0, 8, 0, 0)}
        max={new Date(0, 0, 0, 19, 0, 0)}
        eventPropGetter={eventStyleGetter}
        onSelectSlot={handleSlotSelect}
        onSelectEvent={handleEventSelect}
        selectable
        resources={resources}
        resourceIdAccessor="resourceId"
        resourceTitleAccessor="resourceTitle"
      />
    </div>
  )
}
```

#### Option B: FullCalendar
**Pros:**
- Most feature-rich
- Excellent documentation
- Resource timeline built-in
- Professional appearance

**Cons:**
- Premium features require license ($895/year for scheduler)

---

## 2. Backend API Endpoints Required

### Appointments API
```typescript
// Required endpoints for calendar functionality

// GET /api/v1/appointments/clinic/:clinicSlug
// Query params: startDate, endDate, resourceId, status
interface AppointmentQuery {
  startDate: string // ISO 8601
  endDate: string
  resourceId?: number
  status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
}

// POST /api/v1/appointments
interface CreateAppointment {
  clinicId: number
  clientId: number
  resourceId: number // therapist/room
  startTime: string // ISO 8601
  endTime: string
  appointmentType: string
  notes?: string
  status: 'scheduled'
}

// PUT /api/v1/appointments/:id
interface UpdateAppointment {
  startTime?: string
  endTime?: string
  resourceId?: number
  status?: string
  notes?: string
}

// DELETE /api/v1/appointments/:id
// Soft delete with reason

// GET /api/v1/appointments/:id/conflicts
// Check for scheduling conflicts

// GET /api/v1/resources/clinic/:clinicSlug
// Get available therapists/rooms
interface Resource {
  id: number
  name: string
  type: 'therapist' | 'room' | 'equipment'
  color: string
  availability: {
    dayOfWeek: number
    startTime: string
    endTime: string
  }[]
}
```

### Implementation in Backend
```typescript
// src/controllers/AppointmentController.ts
export class AppointmentController {
  
  async getAppointmentsByClinic(req: Request, res: Response) {
    const { clinicSlug } = req.params
    const { startDate, endDate, resourceId, status } = req.query
    
    // Validate clinic access
    const clinic = await validateClinicAccess(req.user, clinicSlug)
    
    // Build query
    const query: any = {
      clinicId: clinic.id,
      startTime: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }
    
    if (resourceId) query.resourceId = resourceId
    if (status) query.status = status
    
    // Fetch with relations
    const appointments = await Appointment.find(query)
      .populate('client', 'firstName lastName email phone')
      .populate('resource', 'name type color')
      .sort('startTime')
    
    return res.json({
      success: true,
      data: appointments
    })
  }
  
  async createAppointment(req: Request, res: Response) {
    // 1. Validate user has permission
    // 2. Check for conflicts
    // 3. Validate resource availability
    // 4. Create appointment
    // 5. Send confirmation email/SMS
    // 6. Update calendar
  }
  
  async checkConflicts(req: Request, res: Response) {
    const { resourceId, startTime, endTime, excludeId } = req.query
    
    const conflicts = await Appointment.find({
      resourceId,
      _id: { $ne: excludeId },
      $or: [
        {
          startTime: { $lt: new Date(endTime) },
          endTime: { $gt: new Date(startTime) }
        }
      ]
    })
    
    return res.json({
      success: true,
      hasConflicts: conflicts.length > 0,
      conflicts
    })
  }
}
```

---

## 3. Insurance Form Generation

### Current State
- ❌ No insurance details tab functional
- ❌ No form template selection
- ❌ No PDF generation

### Required Implementation

#### Install PDF Generation Library
```bash
npm install jspdf jspdf-autotable
npm install @types/jspdf --save-dev

# OR for more advanced features
npm install @react-pdf/renderer
```

#### Insurance Form Component
```typescript
// app/clinic/[clinic]/clients/[clientId]/insurance/page.tsx
'use client'

import { useState } from 'react'
import { generateInsuranceForm } from '@/lib/pdfGenerator'

const INSURANCE_FORMS = [
  { id: 'supplementary', name: 'SUPPLEMENTARY HEALTH BENEFITS CLAIM FORM' },
  { id: 'pshcp', name: 'Public Service Health Care Plan (PSHCP) Claim Form' },
  { id: 'extended', name: 'Extended Health Care Claim Form' },
  { id: 'group_benefits', name: 'Group Benefits Extended Health Care Claim' },
  { id: 'medical', name: 'MEDICAL FORM' },
  // ... more forms
]

export default function ClientInsurance() {
  const [selectedForm, setSelectedForm] = useState('')
  const [insuranceData, setInsuranceData] = useState({
    provider: '',
    policyNumber: '',
    groupNumber: '',
    memberName: '',
    memberId: '',
    relationship: 'self',
    // ... more fields
  })

  const handleGeneratePDF = async () => {
    const pdf = await generateInsuranceForm(selectedForm, {
      ...insuranceData,
      client: clientData,
      clinic: clinicData
    })
    
    pdf.save(`insurance-form-${clientData.lastName}-${Date.now()}.pdf`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Insurance Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            {/* Insurance provider fields */}
            <Input
              label="Insurance Provider"
              value={insuranceData.provider}
              onChange={(e) => setInsuranceData({...insuranceData, provider: e.target.value})}
            />
            
            {/* More fields... */}
            
            <Select
              label="Form Template"
              value={selectedForm}
              onChange={setSelectedForm}
              options={INSURANCE_FORMS}
            />
            
            <Button onClick={handleGeneratePDF}>
              Generate PDF Form
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### PDF Generator Utility
```typescript
// lib/pdfGenerator.ts
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export const generateInsuranceForm = (formType: string, data: any) => {
  const pdf = new jsPDF()
  
  // Add clinic logo
  if (data.clinic.logo) {
    pdf.addImage(data.clinic.logo, 'PNG', 15, 10, 50, 20)
  }
  
  // Title
  pdf.setFontSize(16)
  pdf.text(INSURANCE_FORMS[formType], 105, 20, { align: 'center' })
  
  // Patient Information Section
  pdf.setFontSize(12)
  pdf.text('Patient Information', 15, 40)
  pdf.setFontSize(10)
  pdf.text(`Name: ${data.client.firstName} ${data.client.lastName}`, 15, 50)
  pdf.text(`Date of Birth: ${data.client.dateOfBirth}`, 15, 57)
  
  // Insurance Information
  pdf.text('Insurance Information', 15, 75)
  pdf.text(`Provider: ${data.provider}`, 15, 85)
  pdf.text(`Policy Number: ${data.policyNumber}`, 15, 92)
  
  // Service Details Table
  const tableData = data.services.map(service => [
    service.date,
    service.description,
    service.code,
    service.amount
  ])
  
  pdf.autoTable({
    head: [['Date', 'Service', 'Code', 'Amount']],
    body: tableData,
    startY: 110
  })
  
  // Signature section
  const finalY = pdf.lastAutoTable.finalY + 20
  pdf.text('Provider Signature: _____________________', 15, finalY)
  pdf.text('Date: _____________________', 120, finalY)
  
  return pdf
}
```

---

## 4. Complete Client Form Fields

### Missing Fields to Add
```typescript
// Update Client model schema
interface Client {
  // Existing fields...
  firstName: string
  lastName: string
  dateOfBirth: Date
  gender: 'male' | 'female' | 'other'
  email: string
  cellPhone: string
  homePhone: string
  
  // ADD THESE MISSING FIELDS:
  
  // Address (change from single field to separate fields)
  streetAddress: string
  apartmentNo?: string
  city: string        // Dropdown with 200+ cities
  province: string    // Dropdown with provinces
  postalCode: string  // Formatted as "A1A 1A1"
  
  // Work Information
  workPhone?: string
  workPhoneExt?: string
  
  // Company
  companyName?: string
  
  // Referral Information
  howDidYouHear?: string    // Dropdown: Concert, Flyer, Promotion, Friends and Family
  howDidYouHearOther?: string
  
  // Medical
  familyMD?: string
  referringMD?: string
  
  // Internal
  csrName?: string          // Dropdown of staff members
  
  // Multi-clinic support
  locations: number[]       // Array of clinic IDs
}
```

### Updated Client Form Component
```typescript
// app/clinic/[clinic]/clients/components/ClientForm.tsx
'use client'

import { CANADIAN_CITIES, PROVINCES } from '@/lib/constants/locations'
import { CSR_STAFF } from '@/lib/constants/staff'

export function ClientForm() {
  return (
    <form className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Input label="First Name" name="firstName" required />
          <Input label="Last Name" name="lastName" required />
          <DatePicker label="Date of Birth" name="dateOfBirth" required />
          <Select label="Gender" name="gender" options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'other', label: 'Other' }
          ]} />
        </CardContent>
      </Card>
      
      {/* Address Information */}
      <Card>
        <CardHeader>
          <CardTitle>Address Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Street Address" name="streetAddress" />
          </div>
          <Input label="Apartment No." name="apartmentNo" />
          <Select 
            label="City" 
            name="city" 
            options={CANADIAN_CITIES}
            searchable
          />
          <Select 
            label="Province" 
            name="province" 
            options={PROVINCES}
          />
          <Input 
            label="Postal Code" 
            name="postalCode" 
            placeholder="A1A 1A1"
            pattern="[A-Za-z][0-9][A-Za-z] [0-9][A-Za-z][0-9]"
          />
        </CardContent>
      </Card>
      
      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Input label="Email Address" name="email" type="email" />
          <Input label="Cell Phone" name="cellPhone" type="tel" />
          <Input label="Home Phone" name="homePhone" type="tel" />
          <Input label="Work Phone" name="workPhone" type="tel" />
          <Input label="Work Phone Ext." name="workPhoneExt" />
        </CardContent>
      </Card>
      
      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Input label="Company Name" name="companyName" />
          <Select 
            label="How did you hear about us?"
            name="howDidYouHear"
            options={[
              { value: 'concert', label: 'Concert' },
              { value: 'flyer', label: 'Flyer' },
              { value: 'promotion', label: 'Promotion' },
              { value: 'friends_family', label: 'Friends and Family' },
              { value: 'other', label: 'Other' }
            ]}
          />
          <Input label="Family MD" name="familyMD" />
          <Input label="Referring MD" name="referringMD" />
          <Select 
            label="CSR Name"
            name="csrName"
            options={CSR_STAFF}
          />
          <MultiSelect
            label="Clinic Locations"
            name="locations"
            options={availableClinics}
          />
        </CardContent>
      </Card>
      
      <Button type="submit">Save Client</Button>
    </form>
  )
}
```

---

## 5. Invoice System Implementation

### Database Schema
```typescript
// models/Invoice.ts
interface Invoice {
  id: number
  invoiceNumber: string // Auto-generated: INV-2025-0001
  clinicId: number
  clientId: number
  appointmentId?: number
  
  // Items
  lineItems: InvoiceLineItem[]
  
  // Amounts
  subtotal: number
  tax: number
  taxRate: number
  total: number
  amountPaid: number
  balance: number
  
  // Status
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  
  // Dates
  issueDate: Date
  dueDate: Date
  paidDate?: Date
  
  // Payment
  paymentMethod?: 'cash' | 'credit' | 'debit' | 'insurance' | 'etransfer'
  paymentNotes?: string
  
  // Additional
  notes?: string
  internalNotes?: string
  
  createdAt: Date
  updatedAt: Date
}

interface InvoiceLineItem {
  description: string
  serviceCode?: string
  quantity: number
  unitPrice: number
  total: number
  taxable: boolean
}
```

### Invoice Generation Component
```typescript
// app/clinic/[clinic]/invoices/[invoiceId]/page.tsx
'use client'

import { generateInvoicePDF } from '@/lib/invoiceGenerator'

export default function InvoiceView({ params }) {
  const { invoice, client, clinic } = useInvoiceData(params.invoiceId)
  
  const handlePrint = () => {
    window.print()
  }
  
  const handleDownloadPDF = async () => {
    const pdf = await generateInvoicePDF({ invoice, client, clinic })
    pdf.save(`invoice-${invoice.invoiceNumber}.pdf`)
  }
  
  const handleReprint = async () => {
    // Log reprint action
    await logInvoiceAction(invoice.id, 'reprinted')
    handlePrint()
  }
  
  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Invoice Header */}
      <div className="flex justify-between mb-8">
        <div>
          <img src={clinic.logo} alt={clinic.name} className="h-16" />
          <h1 className="text-2xl font-bold mt-4">{clinic.name}</h1>
          <p>{clinic.address}</p>
          <p>{clinic.phone}</p>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold">INVOICE</h2>
          <p className="text-lg mt-2">#{invoice.invoiceNumber}</p>
          <p>Date: {formatDate(invoice.issueDate)}</p>
          <p>Due: {formatDate(invoice.dueDate)}</p>
        </div>
      </div>
      
      {/* Bill To */}
      <div className="mb-8">
        <h3 className="font-bold mb-2">Bill To:</h3>
        <p>{client.firstName} {client.lastName}</p>
        <p>{client.streetAddress}</p>
        <p>{client.city}, {client.province} {client.postalCode}</p>
      </div>
      
      {/* Line Items Table */}
      <table className="w-full mb-8">
        <thead>
          <tr className="border-b-2">
            <th className="text-left py-2">Description</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit Price</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item, i) => (
            <tr key={i} className="border-b">
              <td className="py-2">{item.description}</td>
              <td className="text-right">{item.quantity}</td>
              <td className="text-right">${item.unitPrice.toFixed(2)}</td>
              <td className="text-right">${item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64">
          <div className="flex justify-between py-2">
            <span>Subtotal:</span>
            <span>${invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span>Tax ({invoice.taxRate}%):</span>
            <span>${invoice.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2 font-bold border-t-2">
            <span>Total:</span>
            <span>${invoice.total.toFixed(2)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <>
              <div className="flex justify-between py-2">
                <span>Amount Paid:</span>
                <span>${invoice.amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 font-bold">
                <span>Balance Due:</span>
                <span>${invoice.balance.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-4 print:hidden">
        <Button onClick={handlePrint}>Print</Button>
        <Button onClick={handleDownloadPDF}>Download PDF</Button>
        <Button onClick={handleReprint} variant="outline">Reprint</Button>
        <Button variant="outline">Email Invoice</Button>
      </div>
    </div>
  )
}
```

---

## 6. Lab Module Implementation

### Database Schema
```typescript
// models/LabOrder.ts
interface LabOrder {
  id: number
  clinicId: number
  clientId: number
  orderedBy: number // staff user ID
  
  // Lab Information
  labName: string
  testType: string
  testCode?: string
  
  // Dates
  orderDate: Date
  collectionDate?: Date
  receivedDate?: Date
  resultDate?: Date
  
  // Status
  status: 'ordered' | 'collected' | 'sent' | 'received' | 'completed' | 'cancelled'
  
  // Results
  results?: string
  resultsFile?: string // URL to uploaded PDF/image
  normalRange?: string
  interpretation?: string
  
  // Additional
  notes?: string
  urgency: 'routine' | 'urgent' | 'stat'
  
  createdAt: Date
  updatedAt: Date
}
```

---

## 7. Testing Checklist

### Manual Testing
- [ ] Calendar displays correctly in all views
- [ ] Can create appointment by clicking time slot
- [ ] Can drag-and-drop to reschedule
- [ ] Resource filtering works
- [ ] Appointment conflicts are detected
- [ ] Insurance forms generate correctly
- [ ] All PDF forms match original templates
- [ ] Client form saves all fields
- [ ] Invoice calculations are accurate
- [ ] Invoice PDF matches original format
- [ ] Lab orders can be created and tracked

### Integration Testing
```typescript
// __tests__/appointments.test.ts
describe('Appointment Calendar', () => {
  it('should fetch appointments for date range', async () => {
    const response = await request(app)
      .get('/api/v1/appointments/clinic/bodybliss-physio')
      .query({
        startDate: '2025-10-20',
        endDate: '2025-10-27'
      })
      .set('Authorization', `Bearer ${token}`)
    
    expect(response.status).toBe(200)
    expect(response.body.data).toBeInstanceOf(Array)
  })
  
  it('should detect scheduling conflicts', async () => {
    // Create first appointment
    // Try to create overlapping appointment
    // Expect conflict error
  })
})
```

### Performance Testing
- [ ] Calendar loads in < 2 seconds with 1000 appointments
- [ ] Search autocomplete responds in < 500ms
- [ ] PDF generation completes in < 5 seconds

---

## 8. Deployment Checklist

### Before Production
- [ ] All critical features implemented
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] User acceptance testing completed
- [ ] Staff training completed
- [ ] Documentation updated
- [ ] Backup strategy in place
- [ ] Rollback plan prepared

### Environment Variables
```env
# .env.production
NEXT_PUBLIC_API_URL=https://api.bodyblissvisio.com
API_URL=https://api.bodyblissvisio.com
DATABASE_URL=mongodb://...
JWT_SECRET=...
SMTP_HOST=...
SMTP_PORT=...
S3_BUCKET=...
```

---

## Timeline Estimate

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| Calendar Scheduler | 🔴 CRITICAL | 2-3 weeks | Backend API |
| Appointment API | 🔴 CRITICAL | 1 week | Database schema |
| Insurance Forms | 🔴 CRITICAL | 1 week | PDF library |
| Client Form Complete | 🟡 HIGH | 3-4 days | - |
| Invoice System | 🟡 HIGH | 1 week | Database schema |
| Lab Module | 🟢 MEDIUM | 1 week | Database schema |
| Reports Module | 🟢 MEDIUM | 1 week | - |
| Marketing Module | 🟢 LOW | 1 week | - |
| **TOTAL** | | **8-10 weeks** | |

---

## Conclusion

This implementation guide provides a clear roadmap for closing the feature gaps. The most critical path is:

1. **Week 1-3:** Calendar + Appointment API
2. **Week 4:** Insurance forms
3. **Week 5:** Complete client form + Invoice system
4. **Week 6-7:** Lab + Reports modules
5. **Week 8:** Testing + Bug fixes
6. **Week 9-10:** UAT + Training + Deployment

With focused development effort, the application can be production-ready in **2-3 months**.

