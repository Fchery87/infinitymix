/**
 * Test script for HuggingFace Spaces stem separation
 * Usage: node scripts/test-huggingface.mjs <path-to-audio-file>
 */

import { Client } from '@gradio/client';
import fs from 'fs';
import path from 'path';

const HF_SPACE_URL = 'abidlabs/music-separation';

async function testHuggingFace(audioPath) {
  console.log('🔗 Connecting to HuggingFace Space:', HF_SPACE_URL);
  
  const client = await Client.connect(HF_SPACE_URL);
  console.log('✅ Connected successfully!\n');

  if (audioPath) {
    console.log('📁 Loading audio file:', audioPath);
    const audioBuffer = fs.readFileSync(audioPath);
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

    console.log('🎵 Sending for stem separation (this may take 1-3 minutes)...\n');
    const startTime = Date.now();
    
    const result = await client.predict('/predict', [audioBlob]);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`⏱️  Completed in ${elapsed}s\n`);
    console.log('📦 Result structure:');
    console.log(JSON.stringify(result.data, null, 2));

    // Download stems
    const stemNames = ['vocals', 'accompaniment', 'drums', 'bass', 'other'];
    const outputDir = path.join(path.dirname(audioPath), 'hf-stems');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('\n📥 Downloading stems to:', outputDir);
    
    for (let i = 0; i < result.data.length; i++) {
      const stemData = result.data[i];
      const stemName = stemNames[i] || `stem_${i}`;
      
      let url;
      if (typeof stemData === 'string') {
        url = stemData;
      } else if (stemData?.url) {
        url = stemData.url;
      }

      if (url) {
        try {
          const response = await fetch(url);
          const buffer = Buffer.from(await response.arrayBuffer());
          const outputPath = path.join(outputDir, `${stemName}.wav`);
          fs.writeFileSync(outputPath, buffer);
          console.log(`   ✅ ${stemName}.wav (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        } catch (err) {
          console.log(`   ❌ ${stemName}: ${err.message}`);
        }
      }
    }

    console.log('\n🎉 Done! Check the hf-stems folder.');
  } else {
    // Just test connectivity
    console.log('ℹ️  No audio file provided. Connection test passed!');
    console.log('\nUsage: node scripts/test-huggingface.mjs <path-to-mp3>');
  }
}

const audioFile = process.argv[2];
testHuggingFace(audioFile).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
