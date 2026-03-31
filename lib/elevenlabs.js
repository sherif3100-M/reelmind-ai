const VOICE_MAP = {
  deep_male:   'pNInz6obpgDQGcFmaJgB',  // Adam - deep authoritative
  calm_female: 'EXAVITQu4vr4xnSDxMaL',  // Bella - calm soothing
  energetic:   'VR6AewLTigWG4xSOukaG',  // Arnold - high energy
  british:     'onwK4e9ZLuTAKqWW03F9',  // Daniel - British accent
  asmr:        'jBpfuIE2acCO8z3wKNLl',  // Gigi - soft ASMR
};

export async function generateVoice({ text, voiceKey = 'deep_male' }) {
  const voiceId = VOICE_MAP[voiceKey] || VOICE_MAP.deep_male;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${err}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}
