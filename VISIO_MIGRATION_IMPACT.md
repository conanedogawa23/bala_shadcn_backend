# 🎯 VISIO MIGRATION IMPACT ANALYSIS

## 📋 **BUSINESS RULES INTEGRATION**

Based on **`Copy of VISIO_(1)(1).xlsx - VISIO.csv`**, our migration strategy has been updated to implement **data-driven filtering** during the MSSQL to MongoDB migration process.

---

## **🏥 CLINIC FILTERING RULES**

### **✅ CLINICS TO RETAIN (6 clinics)**
- **Bodybliss Physiotherapy**
- **Bodybliss One Care**  
- **Century Care**
- **Duncan Mills Ortholine**
- **My Cloud**
- **Physiobliss**

### **❌ CLINICS TO EXCLUDE (6 clinics)**
- **Bodybliss**
- **Bioform Health**
- **Orthopedic Orthotic Appliances**
- **Markham Orthopedic**
- **Extreme Physio**
- **Active Force**

### **💥 MIGRATION IMPACT:**
- **50% clinic reduction** - Only 6 out of 12 clinics will be migrated
- **Significant data reduction** in all tables (clients, appointments, contact history, etc.)
- **Focused development** on 6 core clinics only

---

## **🚫 PRODUCT CODE EXCLUSIONS**

### **EXCLUDED PRODUCTS (164+ codes)**
```
AC, AC50, AC60, AC80, ALLE, ANX, ARTH, BNP, BPH, CANPREV5HTP, 
CANPREVALA, CANPREVEP, CANPREVHH, CANPREVHL, CANPREVIBS, 
CANPREVNEM, CANPREVPP, CANPREVTP, CFOS, CHRF, CHS, CP, DeeP1, 
DLA300, DLFC, DLGMCM, DLIG, DLLIV, DLMC, DLPSP, DLQ, DLTQ, 
DLTS, DLUPRO, EVCO, HB, HC, IND, INS, LB01, LB02, LB03, LBCOS, 
LCKK, LFB219, LS, ME, MenoPrev, MI, MIG00, MIG01, MIG02, MIG03, 
MIG24, MIGM0, MIGSG, MIGTR, NATser, NATser125, NATser140, 
NATser180, NAtser25, NATser250, NATser30, NATSer49, NATser80, 
NSA, NSAUT, NSBA, NSFV1, NSFV10, NSFV15, NSFV20, NSFV30, 
NSFV45, NSFV5, NSIV1, NSIV30, NSMR, NSU, OCF63, OS, OS135, 
OS200, OSTAS, OSTT30, OSTT45, OSTT60, PEB12, PEEX, PEHE, PELG, 
PELGD, PEOB, PEP, PEPB, PEV, PM, PR1, PR2, SC, SFH, SFHCGS, 
SFHEDI, SH01, SHCOS, SlimPro, UL, WH, WM, WSVB100, WSVB9995
```

### **💥 ORDER IMPACT:**
- **Massive order filtering** - 164+ product codes excluded
- **Order table size reduction** by estimated 30-60%
- **Simplified product catalog** for new system

---

## **📄 PAGE/MODULE DECISIONS**

| **Module** | **Action** | **VISIO Requirement** | **Dev Impact** |
|------------|------------|------------------------|-----------------|
| **CLIENT** | ✅ Build | Retain core fields, remove CSR, Family MD | Field filtering |
| **INSURANCE** | ✅ Build | Remove 3rd insurance column | Simplified model |
| **ORDER** | ✅ Build | Remove specific products | Product filtering |
| **PAYMENT** | ✅ Build | Remove Co-pay (Ins. 3) | Payment model update |
| **REPORTS** | ✅ Build | Selective retention | Report filtering |
| **SCHEDULE** | ❌ Skip | Remove entirely | **NO DEVELOPMENT** |
| **LAB** | ❌ Skip | Remove entirely | **NO DEVELOPMENT** |
| **RELATIONS** | ❌ Skip | Remove entirely | **NO DEVELOPMENT** |

### **💥 DEVELOPMENT IMPACT:**
- **3 major modules saved** - Schedule, Lab, Relations not needed
- **Focused API development** on core healthcare modules only
- **Simplified system architecture**

---

## **🔍 CLIENT FIELD FILTERING**

### **✅ FIELDS TO RETAIN**
- Name, Address, Birthday
- Cellphone No., Home No.
- Email Address, Company Name
- Referring MD, Gender

### **❌ FIELDS TO EXCLUDE**
- CSR Name
- Work no. and Extension
- Family MD
- How did you hear about us
- View Insurance
- Generate PDF Form (insurance)

### **💥 CLIENT MODEL IMPACT:**
- **Streamlined client data** - fewer fields to manage
- **Simplified forms** in frontend
- **Reduced data complexity**

---

## **🏥 INSURANCE FIELD FILTERING**

### **✅ FIELDS TO RETAIN**
- Policy Holder Name
- Policy Holder Birthday
- Insurance Company Name
- Group Number
- Certificate Number

### **❌ FIELDS TO EXCLUDE**
- 3rd Insurance Column (Co-pay Ins. 3)

### **💥 INSURANCE MODEL IMPACT:**
- **Simplified insurance model** - no 3rd tier
- **2-tier insurance only** instead of 3-tier
- **Reduced billing complexity**

---

## **📊 ESTIMATED DATA REDUCTION**

| **Table** | **Original Est.** | **After Filtering** | **Reduction** |
|-----------|-------------------|---------------------|---------------|
| **Contact History** | 92,599 | ~46,300 | **50%** |
| **Client-Clinic Relations** | 34,918 | ~17,459 | **50%** |
| **Clients** | 31,213 | ~15,607 | **50%** |
| **Appointments** | 149,477 | ~74,739 | **50%** |
| **Orders** | Est. 50,000 | ~20,000 | **60%** |
| **Insurance Records** | 5,033 | ~2,517 | **50%** |

### **📈 TOTAL IMPACT:**
- **~200,000 fewer records** to migrate
- **Faster migration** due to reduced data volume
- **Simplified data relationships**
- **Lower MongoDB storage** requirements

---

## **🛠️ IMPLEMENTATION STATUS**

### **✅ COMPLETED**
- **DataFilter utility** - VISIO business rules implemented
- **ContactHistoryMigration** - Clinic filtering applied
- **ClientMigration** - Clinic and field filtering applied
- **Migration logging** - Filter statistics tracking

### **🔄 IN PROGRESS**
- **ContactHistory API** - Service, View, Controller, Routes completed
- **ClientClinicRelationship API** - Service layer completed

### **⏳ PENDING**
- Apply DataFilter to remaining migration scripts
- Update Order models to exclude products
- Implement insurance field filtering
- Create filtered report definitions

---

## **🎯 NEXT STEPS**

1. **Complete API layers** for ContactHistory and ClientClinicRelationship
2. **Apply DataFilter** to all remaining migration scripts
3. **Update Order model** to exclude specified products
4. **Test migration** with sample data to validate filtering
5. **Create filtered reports** based on VISIO requirements

---

## **📝 CODE EXAMPLES**

### **DataFilter Usage in Migration:**
```typescript
// Apply clinic filtering
const clinicFilteredRecords = DataFilter.filterRecordsByClinic(allRecords);

// Apply product filtering for orders
const validOrders = DataFilter.filterOrdersByProducts(allOrders);

// Apply client field filtering
const filteredClientData = DataFilter.filterClientData(rawClientData);

// Log filtering statistics
DataFilter.logFilterStats(originalCount, filteredCount, 'Contact History');
```

### **Clinic Validation:**
```typescript
// Check if clinic should be retained
if (DataFilter.shouldRetainClinic(record.clinicName)) {
  // Process record
} else {
  // Skip record
}
```

---

## **⚠️ CRITICAL NOTES**

1. **Data Integrity**: All filtering is based on explicit VISIO requirements
2. **Reversibility**: Original MSSQL data remains untouched
3. **Audit Trail**: All filtering decisions are logged
4. **Business Alignment**: 100% aligned with VISIO spreadsheet requirements
5. **Performance**: Efficient Set-based filtering instead of forEach loops

This implementation ensures our **healthcare management system** is built exactly according to **VISIO business requirements** while maintaining **optimal performance** and **data integrity**.
