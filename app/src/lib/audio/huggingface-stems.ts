/**
 * HuggingFace Spaces Stem Separation Service
 * Uses free AI stem separation models hosted on HuggingFace Spaces
 * Primary: r3gm/Audio_separator (supports multiple models, 4+ stems)
 * Fallback: abidlabs/music-separation (2-stem only)
 */

import { Client } from '@gradio/client';
import { log } from '@/lib/logger';

type StemType = 'vocals' | 'drums' | 'bass' | 'other';

// HuggingFace Spaces for stem separation (in priority order)
const HF_SPACES = [
  'abidlabs/music-separation',     // Simple 2-stem (vocals + accompaniment)
  'tonyassi/vocal-remover',        // Alternative 2-stem
];

let hfClient: Client | null = null;
let connectedSpace: string | null = null;

async function downloadStem(
  url: string, 
  stemType: StemType, 
  stemMap: Map<StemType, Buffer>
): Promise<void> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      stemMap.set(stemType, Buffer.from(arrayBuffer));
      log('info', 'huggingface.stem.downloaded', { stemType, size: arrayBuffer.byteLength });
    } else {
      log('warn', 'huggingface.stem.fetch.failed', { 
        stemType, 
        url: url.substring(0, 80),
        status: response.status 
      });
    }
  } catch (fetchError) {
    log('warn', 'huggingface.stem.fetch.error', { 
      stemType, 
      url: url.substring(0, 80),
      error: (fetchError as Error).message 
    });
  }
}

async function getHFClient(): Promise<Client> {
  if (!hfClient) {
    // Connect to first available space
    await isHuggingFaceAvailable();
  }
  if (!hfClient) {
    throw new Error('No HuggingFace space available');
  }
  return hfClient;
}

export async function isHuggingFaceAvailable(): Promise<boolean> {
  // Try each space in order until one connects
  for (const space of HF_SPACES) {
    try {
      const client = await Promise.race([
        Client.connect(space),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('HF connection timeout')), 15000)
        ),
      ]);
      hfClient = client;
      connectedSpace = space;
      log('info', 'huggingface.connected', { space });
      return true;
    } catch (error) {
      log('warn', 'huggingface.space.unavailable', { 
        space, 
        error: (error as Error).message 
      });
    }
  }

  log('warn', 'huggingface.all.unavailable', {});
  return false;
}

export async function separateWithHuggingFace(
  audioBuffer: Buffer,
  filename: string
): Promise<Map<StemType, Buffer>> {
  log('info', 'huggingface.separation.start', { filename, space: connectedSpace });

  const client = await getHFClient();
  const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

  try {
    let result;
    
    // Use the appropriate API based on connected space
    if (connectedSpace === 'abidlabs/music-separation') {
      // This space uses fn_index instead of named endpoint
      log('info', 'huggingface.calling.abidlabs', {});
      result = await client.predict(0, [audioBlob]);  // fn_index 0
    } else if (connectedSpace === 'tonyassi/vocal-remover') {
      log('info', 'huggingface.calling.tonyassi', {});
      result = await client.predict(0, [audioBlob]);
    } else {
      // Generic fallback - try fn_index 0
      log('info', 'huggingface.calling.generic', { space: connectedSpace });
      result = await client.predict(0, [audioBlob]);
    }

    const stemMap = new Map<StemType, Buffer>();
    const data = result.data as Array<{ url?: string; path?: string; name?: string } | string>;

    // Log the full structure for debugging
    log('info', 'huggingface.result.structure', { 
      dataLength: data.length,
      dataTypes: data.map((d, i) => ({ 
        index: i, 
        type: typeof d, 
        hasUrl: typeof d === 'object' && d !== null ? !!d.url : false,
        hasPath: typeof d === 'object' && d !== null ? !!d.path : false,
        value: typeof d === 'string' ? d.substring(0, 100) : JSON.stringify(d).substring(0, 100)
      }))
    });

    // Try to extract URLs from all data items
    const extractedUrls: Array<{ url: string; index: number }> = [];
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      let url: string | undefined;
      
      if (typeof item === 'string' && item.startsWith('http')) {
        url = item;
      } else if (item && typeof item === 'object') {
        url = item.url || item.path;
      }
      
      if (url) {
        extractedUrls.push({ url, index: i });
      }
    }

    log('info', 'huggingface.urls.extracted', { 
      count: extractedUrls.length,
      urls: extractedUrls.map(u => ({ index: u.index, url: u.url.substring(0, 80) }))
    });

    // Map stems based on how many we received
    if (extractedUrls.length === 2) {
      // 2-stem model: vocals + accompaniment (no_vocals)
      // Map: index 0 → vocals, index 1 → other (instrumental)
      await downloadStem(extractedUrls[0].url, 'vocals', stemMap);
      await downloadStem(extractedUrls[1].url, 'other', stemMap);
    } else if (extractedUrls.length === 4) {
      // 4-stem model: vocals, drums, bass, other
      const stemNames: StemType[] = ['vocals', 'drums', 'bass', 'other'];
      for (let i = 0; i < extractedUrls.length; i++) {
        await downloadStem(extractedUrls[i].url, stemNames[i], stemMap);
      }
    } else if (extractedUrls.length === 5) {
      // 5-stem model: vocals, accompaniment, drums, bass, other
      // Skip accompaniment at index 1
      const stemNames: StemType[] = ['vocals', 'drums', 'bass', 'other'];
      await downloadStem(extractedUrls[0].url, 'vocals', stemMap);
      await downloadStem(extractedUrls[2].url, 'drums', stemMap);
      await downloadStem(extractedUrls[3].url, 'bass', stemMap);
      await downloadStem(extractedUrls[4].url, 'other', stemMap);
    } else {
      // Unknown format - try to map what we can
      log('warn', 'huggingface.unknown.stem.count', { count: extractedUrls.length });
      const stemNames: StemType[] = ['vocals', 'other', 'drums', 'bass'];
      for (let i = 0; i < Math.min(extractedUrls.length, stemNames.length); i++) {
        await downloadStem(extractedUrls[i].url, stemNames[i], stemMap);
      }
    }

    log('info', 'huggingface.separation.complete', { 
      filename, 
      stemsExtracted: stemMap.size 
    });

    return stemMap;
  } catch (error) {
    log('error', 'huggingface.separation.failed', { 
      filename, 
      error: (error as Error).message 
    });
    throw error;
  }
}

export async function getHuggingFaceStatus(): Promise<{ 
  available: boolean; 
  space: string;
}> {
  const available = await isHuggingFaceAvailable();
  return { 
    available, 
    space: connectedSpace || HF_SPACES[0]
  };
}
