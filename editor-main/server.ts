import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON payload limits (since we might send base64 images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Lazy initializer for Gemini Client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      console.warn('WARNING: GEMINI_API_KEY is not configured or has placeholder value. AI endpoints will run in demo/fallback mode.');
    }
    geminiClient = new GoogleGenAI({
      apiKey: key || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// REST API Endpoints

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Studio Editor API' });
});

// 2. AI Image Analysis (Object detection, Tags, Vibe)
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image base64 data is required' });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      // Fallback Demo Mode if API is missing
      return res.json({
        description: "A gorgeous scenic composition highlighting high-contrast depth, historical fountain architecture, and vibrant background foliage. (DEMO FALLBACK: API KEY NOT SET)",
        vibe: "Warm, Cinematic, and Earthy",
        tags: ["Water Fountain", "Courtyard", "Green Palms", "Classical Architecture", "Crisp Contrast", "Daylight Lighting"],
        cropRecommendation: "Focus on the central fountain utilizing a centered, symmetrical grid.",
        dominantColors: ["#4a5568", "#cbd5e1", "#2f855a", "#d69e2e"]
      });
    }

    // Clean base64 header
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const ai = getGemini();
    const prompt = `Analyze this image in detail. Provide a JSON response describing:
1. 'description' (a concise 1-2 sentence aesthetic description of what is in the image)
2. 'vibe' (a 2-3 word poetic description of the mood or grading vibe, e.g. "Cool Neon Cyberpunk", "Misty Warm Nostalgia", "Slick Editorial Minimalism")
3. 'tags' (an array of 5-8 descriptive label strings of objects, scenes, or categories)
4. 'cropRecommendation' (a short aesthetic crop tip, e.g. "Focus closely on the subject's face using rule of thirds")
5. 'dominantColors' (an array of 4 major prominent hex colors in the image)`;

    const rawResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64
          }
        },
        {
          text: prompt
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            vibe: { type: Type.STRING },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            cropRecommendation: { type: Type.STRING },
            dominantColors: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['description', 'vibe', 'tags', 'cropRecommendation', 'dominantColors']
        }
      }
    });

    const parsedData = JSON.parse(rawResponse.text.trim());
    return res.json(parsedData);
  } catch (err: any) {
    console.error('Error in /api/ai/analyze:', err);
    return res.status(500).json({
      error: 'Failed to analyze image with Gemini',
      details: err.message,
      fallback: {
        description: "Unable to contact Gemini. Captured standard photo composition details.",
        vibe: "Natural & Authentic",
        tags: ["Outdoor Scene", "Bright Horizon", "Organic Assets"],
        cropRecommendation: "Keep original aspect ratio to preserve complete scale.",
        dominantColors: ["#ffffff", "#000000", "#555555", "#888888"]
      }
    });
  }
});

// 3. AI Slider Tuning Enhancements
app.post('/api/ai/enhance', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', vibePreference = 'natural' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image base64 is required' });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      // Demo presets recommendation
      return res.json({
        adjustments: {
          brightness: 10,
          contrast: 15,
          exposure: 5,
          highlights: -5,
          shadows: 8,
          saturation: 12,
          temperature: -5,
          tint: 3,
          vibrance: 15,
          vignette: 10,
          sharpness: 20
        },
        explanation: "Slightly boosted exposure and contrast to make details in the fountain pop, with a cool tint for fresh air. (DEMO FALLBACK: API NOT AVAILABLE)"
      });
    }

    // Clean base64 header
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const ai = getGemini();
    const prompt = `Recommend specific, tasteful Lightroom-style slider adjustments to achieve a target vibe of "${vibePreference}" on this image.
Provide a JSON response containing:
1. 'adjustments' with numeric parameters:
   - brightness (-100 to 100)
   - contrast (-100 to 100)
   - exposure (-100 to 100)
   - highlights (-100 to 100)
   - shadows (-100 to 100)
   - saturation (-100 to 100)
   - temperature (-100 to 100)
   - tint (-100 to 100)
   - vibrance (-100 to 100)
   - vignette (0 to 100)
   - sharpness (0 to 100)
2. 'explanation' (a 1 sentence explanation of what editorial look you targeted and why)`;

    const rawResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64
          }
        },
        {
          text: prompt
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            adjustments: {
              type: Type.OBJECT,
              properties: {
                brightness: { type: Type.INTEGER },
                contrast: { type: Type.INTEGER },
                exposure: { type: Type.INTEGER },
                highlights: { type: Type.INTEGER },
                shadows: { type: Type.INTEGER },
                saturation: { type: Type.INTEGER },
                temperature: { type: Type.INTEGER },
                tint: { type: Type.INTEGER },
                vibrance: { type: Type.INTEGER },
                vignette: { type: Type.INTEGER },
                sharpness: { type: Type.INTEGER }
              },
              required: [
                'brightness', 'contrast', 'exposure', 'highlights', 'shadows',
                'saturation', 'temperature', 'tint', 'vibrance', 'vignette', 'sharpness'
              ]
            },
            explanation: { type: Type.STRING }
          },
          required: ['adjustments', 'explanation']
        }
      }
    });

    const parsedData = JSON.parse(rawResponse.text.trim());
    return res.json(parsedData);
  } catch (err: any) {
    console.error('Error in /api/ai/enhance:', err);
    return res.status(500).json({
      error: 'Failed to enhance image with Gemini',
      details: err.message,
      fallback: {
        adjustments: {
          brightness: 8,
          contrast: 12,
          exposure: 3,
          highlights: -5,
          shadows: 5,
          saturation: 8,
          temperature: -5,
          tint: 2,
          vibrance: 10,
          vignette: 5,
          sharpness: 15
        },
        explanation: "Unable to query Gemini. Applied general natural vibrance booster."
      }
    });
  }
});

// 4. AI Interactive Markup Suggestions / Smart Object Framing
app.post('/api/ai/frame-objects', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', targetQuery = 'water fountain' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image base64 is required' });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'MY_GEMINI_API_KEY') {
      // Demo detection box
      return res.json({
        boxes: [
          {
            label: `Detected: ${targetQuery}`,
            x: 25,
            y: 10,
            width: 50,
            height: 75,
            message: `Gemini recommends adding a Text and Arrow pointing to the ${targetQuery}. (DEMO)`
          }
        ]
      });
    }

    // Clean base64 header
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const ai = getGemini();
    const prompt = `We want to interactively focus or point out specific items in the canvas. Identify up to 3 objects corresponding to or related to the queries: "${targetQuery}".
For each object spotted, estimate its bounding box inside the image boundaries in percentage space (from 0 to 100 relative coordinates):
x (horizontal start, 0-100), y (vertical start, 0-100), width (0-100), height (0-100).
Also provide a 'label' string (the object name) and 'message' (a short artistic design tip why you pointed it out).
Return in a JSON list format.`;

    const rawResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64
          }
        },
        {
          text: prompt
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            boxes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  x: { type: Type.INTEGER, description: "0-100 start" },
                  y: { type: Type.INTEGER, description: "0-100 start" },
                  width: { type: Type.INTEGER, description: "0-100 span" },
                  height: { type: Type.INTEGER, description: "0-100 span" },
                  message: { type: Type.STRING }
                },
                required: ['label', 'x', 'y', 'width', 'height', 'message']
              }
            }
          },
          required: ['boxes']
        }
      }
    });

    const parsedData = JSON.parse(rawResponse.text.trim());
    return res.json(parsedData);
  } catch (err: any) {
    console.error('Error in /api/ai/frame-objects:', err);
    return res.status(500).json({
      error: 'Failed to find objects with Gemini',
      details: err.message,
      fallback: {
        boxes: [
          {
            label: "Detected Object Focus",
            x: 30,
            y: 20,
            width: 40,
            height: 60,
            message: "Applied basic central safe region highlight."
          }
        ]
      }
    });
  }
});


// Serve Vite integration

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Studio Editor Server] Running on http://localhost:${PORT}`);
    console.log(`Loaded Port Ingress configuration: ${PORT} -> routing OK`);
  });
}

startServer();
