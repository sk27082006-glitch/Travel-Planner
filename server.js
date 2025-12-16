import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Get API key from environment variables
const API_KEY = process.env.GEMINI_API_KEY;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Log API key status on startup
console.log("🔑 API Key Status:", API_KEY ? "Configured" : "Not configured");
if (API_KEY) {
  console.log("🔐 API Key preview:", API_KEY.substring(0, 10) + "...");
} else {
  console.log("⚠️  WARNING: No API key found!");
  console.log("💡 To fix this:");
  console.log("   1. Create a file named '.env' in your project folder");
  console.log("   2. Add this line: GEMINI_API_KEY=your_api_key_here");
  console.log("   3. Get your key from: https://makersuite.google.com/app/apikey");
  console.log("   4. Restart the server");
}

// Use the NEW model names
const WORKING_MODELS = [
  "gemini-2.0-flash",        // Fast and reliable (recommended)
  "gemini-2.0-flash-001",    // Stable version
  "gemini-2.5-flash",        // Latest Flash model (supports 1M tokens)
  "gemini-2.5-pro",          // Latest Pro model
  "gemini-2.0-flash-lite",   // Lite version
  "gemini-2.5-flash-lite"    // Latest Lite version
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    apiKeyConfigured: !!API_KEY,
    availableModels: WORKING_MODELS,
    timestamp: new Date().toISOString(),
    note: API_KEY ? "Using Gemini API" : "Using mock data only"
  });
});

// List available models endpoint
app.get('/models', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.json({ 
        error: "API key not configured",
        suggestion: "Create .env file with GEMINI_API_KEY=your_key",
        availableModels: WORKING_MODELS
      });
    }
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      }
    );
    
    const data = await response.json();
    
    // Filter to models that support generateContent
    const generateContentModels = data.models?.filter(model => 
      model.supportedGenerationMethods?.includes("generateContent")
    ) || [];
    
    res.json({
      allModels: data.models?.map(m => m.name) || [],
      generateContentModels: generateContentModels.map(m => ({
        name: m.name,
        displayName: m.displayName,
        description: m.description
      })),
      count: generateContentModels.length
    });
    
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ 
      error: error.message,
      availableModels: WORKING_MODELS
    });
  }
});

// Generate itinerary endpoint
app.post("/generate", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { prompt } = req.body;
    
    console.log(`\n📝 Received request: "${prompt}"`);
    
    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({ 
        success: false, 
        error: "Please provide a travel description (min 3 characters)" 
      });
    }

    // USE GEMINI API IF AVAILABLE
    if (API_KEY) {
      let successfulModel = null;
      let geminiResponse = null;
      
      // Try each working model
      for (const modelName of WORKING_MODELS) {
        try {
          console.log(`🤖 Trying model: ${modelName}`);
          
          const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${API_KEY}`;
          
          // Prepare the system prompt
          const systemPrompt = `You are an expert travel planner. Create a detailed travel itinerary in valid JSON format.

IMPORTANT: Return ONLY valid JSON, no other text.

JSON Format:
{
  "destination": "City, Country",
  "duration": "X days/Y nights",
  "budgetLevel": "Budget/Mid-range/Luxury",
  "bestSeason": "Season/Months",
  "highlights": ["highlight1", "highlight2", "highlight3"],
  "itinerary": [
    {
      "day": 1,
      "theme": "Day theme",
      "morning": "Activity description",
      "afternoon": "Activity description",
      "evening": "Activity description",
      "accommodation": "Hotel/lodge suggestion"
    }
  ],
  "packingTips": ["tip1", "tip2", "tip3"],
  "localCuisine": ["dish1", "dish2"],
  "safetyNotes": ["note1", "note2"]
}

User Request: ${prompt}

Generate a complete itinerary based on the user's request.`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          geminiResponse = await fetch(apiUrl, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json" 
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: systemPrompt }]
                }
              ],
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2000,
              }
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (geminiResponse.ok) {
            successfulModel = modelName;
            console.log(`✅ Model ${modelName} is working!`);
            break;
          } else {
            const errorData = await geminiResponse.json().catch(() => ({}));
            console.log(`⚠️ Model ${modelName} failed: ${errorData.error?.message || geminiResponse.status}`);
          }
          
        } catch (modelError) {
          console.log(`❌ Model ${modelName} error: ${modelError.message}`);
          continue;
        }
      }
      
      // If we found a working model
      if (successfulModel && geminiResponse && geminiResponse.ok) {
        const data = await geminiResponse.json();
        const itineraryText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const responseTime = Date.now() - startTime;
        
        // Clean the response
        let cleanItinerary = itineraryText
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
        
        console.log(`✅ Gemini API successful with ${successfulModel} in ${responseTime}ms`);
        
        return res.json({
          success: true,
          itinerary: cleanItinerary,
          metadata: {
            source: "gemini-api",
            model: successfulModel,
            responseTime: `${responseTime}ms`,
            promptLength: prompt.length
          }
        });
      } else {
        console.log("⚠️ All Gemini models failed, using mock data");
      }
    } else {
      console.log("ℹ️ No API key configured, using mock data");
    }
    
    // FALLBACK TO MOCK DATA (if API fails or no key)
    console.log("🔄 Using mock data fallback");
    const mockResponse = createMockItinerary(prompt);
    const responseTime = Date.now() - startTime;
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    console.log(`✅ Mock data generated in ${responseTime}ms`);
    
    res.json({ 
      success: true, 
      itinerary: mockResponse,
      metadata: {
        source: "mock-data",
        responseTime: `${responseTime}ms`,
        note: API_KEY ? "Gemini API unavailable" : "No API key configured"
      }
    });
    
  } catch (error) {
    console.error("❌ Server error:", error);
    const responseTime = Date.now() - startTime;
    
    res.status(500).json({ 
      success: false, 
      error: "Failed to generate itinerary",
      details: error.message,
      responseTime: `${responseTime}ms`
    });
  }
});

// Mock data function
function createMockItinerary(prompt) {
  const promptLower = prompt.toLowerCase();
  
  let itinerary = {
    destination: "Custom Destination",
    duration: "3 days",
    budgetLevel: "Mid-range",
    bestSeason: "Spring/Fall",
    highlights: ["Local attractions", "Cultural experiences"],
    itinerary: [
      {
        day: 1,
        theme: "Arrival & Exploration",
        morning: "Check into accommodation",
        afternoon: "Explore local area",
        evening: "Welcome dinner",
        accommodation: "Hotel in city center"
      },
      {
        day: 2,
        theme: "Main Attractions",
        morning: "Visit top attractions",
        afternoon: "Cultural experience",
        evening: "Local cuisine",
        accommodation: "Hotel in city center"
      }
    ],
    packingTips: ["Comfortable shoes", "Weather-appropriate clothing"],
    localCuisine: ["Local specialty 1", "Local specialty 2"],
    safetyNotes: ["Keep valuables secure"],
    estimatedCost: "$800-$1200",
    generatedFor: prompt
  };
  
  if (promptLower.includes("kyoto") || promptLower.includes("japan")) {
    itinerary.destination = "Kyoto, Japan";
    itinerary.highlights = ["Kinkaku-ji Temple", "Fushimi Inari Shrine", "Arashiyama"];
    itinerary.localCuisine = ["Matcha desserts", "Kaiseki", "Sushi"];
  } else if (promptLower.includes("paris") || promptLower.includes("france")) {
    itinerary.destination = "Paris, France";
    itinerary.highlights = ["Eiffel Tower", "Louvre", "Notre-Dame"];
    itinerary.localCuisine = ["Croissants", "Escargot", "Wine"];
  } else if (promptLower.includes("bali")) {
    itinerary.destination = "Bali, Indonesia";
    itinerary.highlights = ["Rice Terraces", "Beaches", "Temples"];
    itinerary.localCuisine = ["Nasi Goreng", "Satay", "Fresh fruit"];
  }
  
  return JSON.stringify(itinerary, null, 2);
}

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${process.cwd()}`);
  console.log(`\n📋 Available endpoints:`);
  console.log(`   • Main app: http://localhost:${PORT}`);
  console.log(`   • Health: http://localhost:${PORT}/health`);
  console.log(`   • Models: http://localhost:${PORT}/models`);
  console.log(`   • Generate: POST http://localhost:${PORT}/generate`);
  console.log(`\n🎯 Available Gemini Models (${WORKING_MODELS.length}):`);
  WORKING_MODELS.forEach((model, i) => {
    console.log(`   ${i+1}. ${model}`);
  });
  console.log(`\n🔧 Mode: ${API_KEY ? "Gemini 2.x API with mock fallback" : "Mock data only"}`);
  if (!API_KEY) {
    console.log(`\n⚠️  IMPORTANT: To use real AI, create .env file with:`);
    console.log(`   GEMINI_API_KEY=your_api_key_here`);
  }
});