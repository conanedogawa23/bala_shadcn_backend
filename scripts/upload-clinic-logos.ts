import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { ClinicModel } from '../src/models/Clinic';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Clinic name to logo file mapping
const CLINIC_LOGO_MAPPING: Record<string, string> = {
  'bodyblissphysio': 'bodybliss.png',
  'BodyBlissOneCare': 'bodybliss_one_care.png',
  'My Cloud': 'my_cloud.png',
  'Ortholine Duncan Mills': 'ortholine.png',
  'Century Care': 'century_care.png'
};

async function uploadClinicLogos() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/visio';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully');

    const logosDir = path.join(__dirname, '..', 'logos');
    console.log(`\nReading logos from: ${logosDir}\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    // Process each clinic logo
    for (const [clinicName, logoFileName] of Object.entries(CLINIC_LOGO_MAPPING)) {
      const logoPath = path.join(logosDir, logoFileName);

      // Check if logo file exists
      if (!fs.existsSync(logoPath)) {
        console.log(`⚠️  Logo file not found: ${logoFileName} for clinic: ${clinicName}`);
        skippedCount++;
        continue;
      }

      // Read logo file and convert to base64
      const logoBuffer = fs.readFileSync(logoPath);
      const base64Logo = logoBuffer.toString('base64');
      const contentType = 'image/png';

      // Find and update clinic with case-insensitive search using findOneAndUpdate
      // This bypasses validation and directly updates the logo field
      const result = await ClinicModel.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${clinicName}$`, 'i') } },
        {
          $set: {
            logo: {
              data: base64Logo,
              contentType: contentType,
              filename: logoFileName,
              uploadedAt: new Date()
            }
          }
        },
        { new: true, runValidators: false } // Skip validation
      );

      if (!result) {
        console.log(`⚠️  Clinic not found in database: ${clinicName}`);
        skippedCount++;
        continue;
      }

      const clinic = result;
      
      const sizeKB = (logoBuffer.length / 1024).toFixed(2);
      console.log(`✅ Updated ${clinic.displayName} (${clinic.name}) with ${logoFileName} (${sizeKB}KB)`);
      updatedCount++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${updatedCount} clinics`);
    console.log(`   ⚠️  Skipped: ${skippedCount} clinics`);
    console.log('\n✨ Logo upload completed successfully!\n');

  } catch (error) {
    console.error('❌ Error uploading logos:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the upload script
uploadClinicLogos()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

