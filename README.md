# Visio Backend

Node.js/Express/MongoDB backend API for the Visio clinic management system, designed to replace mock APIs with real-time functionality and MSSQL to MongoDB migration capabilities.

## 🏗️ Architecture

This project follows **strict MVC (Model-View-Controller)** architecture:

- **Models** (`src/models/`) - Mongoose schemas and data models
- **Views** (`src/views/`) - Response formatting and serialization 
- **Controllers** (`src/controllers/`) - Thin route handlers that coordinate between services and views
- **Services** (`src/services/`) - Business logic layer
- **Routes** (`src/routes/`) - Express route definitions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+
- MSSQL Server (for migration)

### Installation

1. **Clone and install dependencies:**
```bash
cd visio_health_backend
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Start development server:**
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## 📁 Project Structure

```
visio_health_backend/
├── src/
│   ├── models/             # Mongoose schemas (MODEL layer)
│   ├── views/              # Response formatters (VIEW layer)  
│   ├── controllers/        # Route handlers (CONTROLLER layer)
│   ├── services/           # Business logic
│   ├── routes/             # Express routes
│   ├── middleware/         # Custom middleware
│   ├── utils/              # Helper functions
│   ├── config/             # Configuration files
│   └── migrations/         # MSSQL to MongoDB migration scripts
├── tests/                  # Test files
├── docs/                   # API documentation
└── logs/                   # Application logs
```

## 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run build           # Build TypeScript
npm run start           # Start production server

# Testing
npm test                # Run tests
npm run test:watch      # Run tests in watch mode

# Database Migration
npm run migrate:clinics     # Migrate clinic data from MSSQL
npm run migrate:clients     # Migrate client data from MSSQL
npm run migrate:synthetic   # Generate synthetic transactional data

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
```

## 🗄️ Database Models

### Clinic Model
Based on MSSQL `sb_clinic` table analysis (13 clinics):

```typescript
interface IClinic {
  clinicId: number;           // From MSSQL
  name: string;              // Unique clinic name
  displayName: string;       // Display name
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  contact: {
    phone?: string;
    email?: string;
  };
  status: 'active' | 'inactive' | 'historical' | 'no-data';
  clientCount: number;
  stats: {
    totalOrders: number;
    totalRevenue: number;
    lastActivity?: Date;
  };
}
```

### Client Model
Based on MSSQL `sb_clients` table analysis (31,213 clients):

```typescript
interface IClient {
  clientId: string;          // Unique client ID
  personalInfo: {
    firstName: string;
    lastName: string;
    fullName: string;        // Auto-generated
    dateOfBirth?: Date;
    gender: 'Male' | 'Female' | 'Other';
  };
  contact: {
    address: {
      street?: string;
      city: string;
      province: string;
      postalCode?: string;
    };
    phones: {
      home?: string;
      cell?: string;
      work?: string;
    };
    email?: string;
  };
  medical: {
    familyMD?: string;
    referringMD?: string;
    csrName?: string;
  };
  insurance: IInsurance[];   // Up to 3 insurance providers
  defaultClinic: string;
  isActive: boolean;
}
```

## 🔌 API Endpoints

### Clinics
```
GET    /api/v1/clinics                    # List all clinics
GET    /api/v1/clinics/active             # Get active clinics
GET    /api/v1/clinics/:id                # Get clinic by ID
GET    /api/v1/clinics/name/:name         # Get clinic by name
GET    /api/v1/clinics/:id/stats          # Get clinic statistics
POST   /api/v1/clinics                    # Create clinic
PUT    /api/v1/clinics/:id                # Update clinic
DELETE /api/v1/clinics/:id                # Delete clinic (soft)
```

### Clients
```
GET    /api/v1/clients/search             # Search clients
GET    /api/v1/clients/:id                # Get client by ID
GET    /api/v1/clients/clinic/:clinic     # Get clients by clinic
GET    /api/v1/clients/clinic/:clinic/insurance    # Clients with insurance
GET    /api/v1/clients/clinic/:clinic/stats        # Client statistics
POST   /api/v1/clients                    # Create client
PUT    /api/v1/clients/:id                # Update client
DELETE /api/v1/clients/:id                # Delete client (soft)
```

### System
```
GET    /health                            # Health check
GET    /api/v1/status                     # System status
GET    /api/v1/docs                       # API documentation
```

## 📊 Data Migration

The system includes migration tools to transfer data from MSSQL VISIO_10 database:

### Current MSSQL Data
- **31,213 clients** across 13 clinics
- **Rich client data** with insurance and medical information
- **No transactional data** (orders/payments are empty)

### Migration Process
1. **Clinic Migration**: `npm run migrate:clinics`
2. **Client Migration**: `npm run migrate:clients` 
3. **Synthetic Data**: `npm run migrate:synthetic`

## 🔧 Configuration

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/visio

# MSSQL (for migration)
MSSQL_SERVER=localhost
MSSQL_DATABASE=VISIO_10
MSSQL_USER=sa
MSSQL_PASSWORD=your_password

# Security
JWT_SECRET=your_secret_key
BCRYPT_ROUNDS=12

# Logging
LOG_LEVEL=info
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testPathPattern=clinic
```

## 📝 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {...},
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Client with id 12345 not found"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/clients/12345",
  "method": "GET"
}
```

## 🔒 Security

- **Helmet.js** for security headers
- **CORS** configuration
- **Rate limiting** (100 requests/15 minutes)
- **Input validation** with express-validator
- **MongoDB injection** prevention
- **Request sanitization**

## 📈 Performance

- **Connection pooling** for MongoDB
- **Query optimization** with proper indexing
- **Pagination** for large datasets
- **Response caching** for static data
- **Error logging** and monitoring

## 🤝 Development Guidelines

### Strict MVC Rules
1. **Controllers** - Only coordinate between services and views
2. **Services** - All business logic goes here
3. **Models** - Data structure and simple methods only
4. **Views** - Response formatting only

### Code Standards
- **TypeScript** strict mode
- **ESLint** for code quality
- **Consistent error handling**
- **Comprehensive logging**
- **Input validation** on all endpoints

## 🚧 Future Enhancements

- [ ] Authentication and authorization
- [ ] Order and payment management
- [ ] File upload capabilities
- [ ] Advanced reporting
- [ ] Real-time notifications
- [ ] API documentation with Swagger
- [ ] Comprehensive test coverage
- [ ] Performance monitoring

## 📞 Support

For issues and questions:
- Check the API documentation: `GET /api/v1/docs`
- Review the logs in `logs/` directory
- Ensure database connectivity: `GET /api/v1/status`

## 📄 License

MIT License - see LICENSE file for details.
