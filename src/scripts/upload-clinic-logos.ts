import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { ClinicModel } from '../models/Clinic';

// Logo mapping: filename -> clinic name in MongoDB
const LOGO_MAPPING: Record<string, string> = {
  'bodybliss.png': 'bodyblissphysio',
  'bodybliss_one_care.png': 'BodyBlissOneCare',
  'century_care.png': 'Century Care',
  'my_cloud.png': 'My Cloud',
  'ortholine.png': 'Ortholine Duncan Mills'
};

/**
 * Convert image file to Base64 string
 */
function imageToBase64(filePath: string): string {
  const imageBuffer = fs.readFileSync(filePath);
  return imageBuffer.toString('base64');
}

/**
 * Get content type from filename
 */
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
  };
  return contentTypes[ext] || 'image/png';
}

/**
 * Upload logos to clinic documents in MongoDB
 */
async function uploadClinicLogos() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/visio';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    const logosDir = path.join(__dirname, '../../logos');
    
    if (!fs.existsSync(logosDir)) {
      throw new Error(`Logos directory not found: ${logosDir}`);
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each logo file
    for (const [filename, clinicName] of Object.entries(LOGO_MAPPING)) {
      const logoPath = path.join(logosDir, filename);
      
      if (!fs.existsSync(logoPath)) {
        console.error(`✗ Logo file not found: ${logoPath}`);
        errorCount++;
        continue;
      }

      try {
        // Find clinic by name
        const clinic = await ClinicModel.findOne({ name: clinicName });
        
        if (!clinic) {
          console.error(`✗ Clinic not found: ${clinicName}`);
          errorCount++;
          continue;
        }

        // Convert image to Base64
        console.log(`Processing ${filename} for ${clinicName}...`);
        const base64Data = imageToBase64(logoPath);
        const contentType = getContentType(filename);

        // Update clinic with logo data
        clinic.logo = {
          data: base64Data,
          contentType: contentType,
          filename: filename,
          uploadedAt: new Date()
        };

        await clinic.save();
        
        console.log(`✓ Uploaded logo for ${clinicName} (${filename})`);
        console.log(`  - Clinic ID: ${clinic.clinicId}`);
        console.log(`  - Content Type: ${contentType}`);
        console.log(`  - Base64 size: ${base64Data.length} characters`);
        successCount++;
      } catch (error) {
        console.error(`✗ Error processing ${filename}:`, error);
        errorCount++;
      }
    }

    console.log('\n=== Upload Summary ===');
    console.log(`✓ Success: ${successCount}`);
    console.log(`✗ Errors: ${errorCount}`);
    console.log(`Total: ${Object.keys(LOGO_MAPPING).length}`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  uploadClinicLogos()
    .then(() => {
      console.log('\n✓ Logo upload completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Logo upload failed:', error);
      process.exit(1);
    });
}

export { uploadClinicLogos };

