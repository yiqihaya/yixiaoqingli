import { registerPlugin } from '@capacitor/core';

export interface NativeTTSSpeakOptions {
  text: string;
}

export interface NativeTTSPlugin {
  speak(options: NativeTTSSpeakOptions): Promise<void>;
  stop(): Promise<void>;
}

const NativeTTS = registerPlugin<NativeTTSPlugin>('NativeTTS', {
  web: () => Promise.resolve({
    speak: async () => { throw new Error('Native TTS not available on web'); },
    stop: async () => {},
  } as NativeTTSPlugin),
});

export default NativeTTS;
