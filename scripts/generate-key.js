#!/usr/bin/env node

/**
 * Generate Encryption Key Script
 * 
 * This script generates a cryptographically secure encryption key
 * for use with the GutCheck application.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate a secure random key (32 bytes = 256 bits)
function generateKey() {
  // Generate a random 32-byte (256-bit) key
  const key = crypto.randomBytes(32);
  
  // Return both hex and raw formats
  return {
    hex: key.toString('hex'),
    raw: key.toString('utf8')
  };
}

// Main function
function main() {
  try {
    console.log('Generating secure encryption key...');
    const key = generateKey();
    
    console.log('\n=== ENCRYPTION KEY GENERATED SUCCESSFULLY ===\n');
    console.log('Raw key (32 bytes):');
    console.log(key.raw);
    console.log('\nHex key (64 characters):');
    console.log(key.hex);
    
    console.log('\n=== INSTRUCTIONS ===');
    console.log('1. Add this key to your .env file:');
    console.log('ENCRYPTION_KEY=' + key.raw);
    console.log('\n2. Or use the hex version if preferred:');
    console.log('ENCRYPTION_KEY=' + key.hex);
    console.log('\nNOTE: The raw key is more compact but may contain special characters.');
    console.log('The hex key is longer but contains only alphanumeric characters.');
    
    // Offer to update the .env file
    console.log('\nWould you like to update your .env file automatically? (y/n)');
    process.stdin.once('data', (input) => {
      const answer = input.toString().trim().toLowerCase();
      
      if (answer === 'y' || answer === 'yes') {
        try {
          const envPath = path.join(__dirname, '..', '.env');
          let envContent = '';
          
          // Read existing .env file if it exists
          if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
            
            // Replace existing ENCRYPTION_KEY or add a new one
            if (envContent.includes('ENCRYPTION_KEY=')) {
              envContent = envContent.replace(
                /ENCRYPTION_KEY=.*/,
                `ENCRYPTION_KEY=${key.hex}`
              );
            } else {
              envContent += `\nENCRYPTION_KEY=${key.hex}`;
            }
          } else {
            envContent = `ENCRYPTION_KEY=${key.hex}`;
          }
          
          // Write updated content back to .env
          fs.writeFileSync(envPath, envContent);
          console.log('\n✅ .env file updated successfully with the new encryption key.');
        } catch (err) {
          console.error('\n❌ Error updating .env file:', err.message);
        }
      } else {
        console.log('\nNo changes made to .env file. Please update it manually.');
      }
      
      process.exit(0);
    });
  } catch (error) {
    console.error('Error generating encryption key:', error);
    process.exit(1);
  }
}

// Run the script
main();
