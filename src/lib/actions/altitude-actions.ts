"use server"

import { revalidatePath } from "next/cache"

export interface MidAltitudePlace {
  id: string
  name: string
  elevation: string
  coordinates: {
    lat: number
    lng: number
  }
  description: string
  risk: "Low" | "Medium" | "High"
  status: "Accessible" | "Caution" | "Dangerous"
  distanceFromUser: string
}

export async function findMidAltitudePlaces(
  latitude: number,
  longitude: number,
): Promise<{ success: boolean; places: MidAltitudePlace[]; error?: string }> {
  try {
    console.log(`Starting mid-altitude places search for coordinates: ${latitude}, ${longitude}`)

    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      console.log("No Gemini API key found, using sample data")
      return {
        success: true,
        places: getSamplePlaces(latitude, longitude),
      }
    }

    const prompt = `
      I need to find mid altitude places (hills, viewpoints, plateaus, etc.) STRICTLY WITHIN a 5km radius of the following coordinates:
      Latitude: ${latitude}
      Longitude: ${longitude}

      IMPORTANT: All locations MUST be within 5km of these coordinates. Do not include anything beyond 5km.

      Please provide exactly 3 locations with the following information for each:
      1. Name of the place
      2. Approximate elevation (in feet)
      3. Coordinates (latitude and longitude)
      4. Brief description (1-2 sentences)
      5. Risk level (Low, Medium, or High)
      6. Status (Accessible, Caution, or Dangerous)
      7. Approximate distance from the user's location (MUST be less than 5km)

      Format your response as a JSON array with objects containing these fields:
      [
        {
          "id": "1",
          "name": "Name of place",
          "elevation": "Elevation in feet",
          "coordinates": {
            "lat": latitude,
            "lng": longitude
          },
          "description": "Brief description",
          "risk": "Risk level",
          "status": "Status",
          "distanceFromUser": "Distance in km"
        },
        ...
      ]
      
      CRITICAL: All locations MUST be within 5km of the provided coordinates.
      Only return the JSON array, nothing else.
    `

    try {
      // Direct fetch to Gemini API to avoid TypeScript issues
      console.log("Sending request to Gemini API")
      const apiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent"
      console.log(`Using API URL: ${apiUrl}`)

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.NEXT_PUBLIC_GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      })

      console.log(`Gemini API response status: ${response.status}`)

      if (!response.ok) {
        let errorText = ""
        try {
          const errorData = await response.json()
          errorText = JSON.stringify(errorData)
          console.error("API error response:", errorData)
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError)
          errorText = await response.text().catch(() => "Could not read error response")
        }

        console.error(`API error: ${response.status} ${response.statusText}. Response: ${errorText}`)
        return {
          success: false,
          places: getSamplePlaces(latitude, longitude),
          error: `API error: ${response.status} ${response.statusText}. Please check your API key and network.`,
        }
      }

      const data = await response.json()
      console.log("Received response from Gemini API")

      // Check if the response has the expected structure
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
        console.error("Unexpected API response structure:", JSON.stringify(data).substring(0, 200) + "...")
        return {
          success: false,
          places: getSamplePlaces(latitude, longitude),
          error: "Unexpected API response structure",
        }
      }

      // Extract text from Gemini response
      const text = data.candidates[0].content.parts[0].text || ""

      if (!text) {
        console.error("Empty text in Gemini API response")
        return {
          success: false,
          places: getSamplePlaces(latitude, longitude),
          error: "Empty response from Gemini API",
        }
      }

      console.log("Raw Gemini response length:", text.length)
      console.log("Response preview:", text.substring(0, 100) + "...")

      // Try multiple approaches to extract JSON
      let places: MidAltitudePlace[] | null = null

      // Approach 1: Try to parse the entire response as JSON
      try {
        places = JSON.parse(text) as MidAltitudePlace[]
        console.log("Successfully parsed entire response as JSON array")
      } catch (parseError) {
        console.log("Could not parse entire response as JSON array, trying to extract JSON:", parseError)
      }

      // Approach 2: Try to extract JSON using regex if approach 1 failed
      if (!places) {
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          try {
            places = JSON.parse(jsonMatch[0]) as MidAltitudePlace[]
            console.log("Successfully parsed JSON array using regex extraction")
          } catch (parseError) {
            console.error("Error parsing extracted JSON array:", parseError)
          }
        } else {
          console.log("No JSON array found in response using regex")
        }
      }

      // Approach 3: Try to find JSON between markdown code blocks
      if (!places) {
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (codeBlockMatch && codeBlockMatch[1]) {
          try {
            places = JSON.parse(codeBlockMatch[1]) as MidAltitudePlace[]
            console.log("Successfully parsed JSON array from code block")
          } catch (parseError) {
            console.error("Error parsing JSON array from code block:", parseError)
          }
        } else {
          console.log("No code block found in response")
        }
      }

      // If we have valid JSON data, return it
      if (places && Array.isArray(places)) {
        // Filter out any places that are beyond 5km
        places = places.filter((place) => {
          if (!place.distanceFromUser) return true

          // Extract the numeric part of the distance string (e.g., "3.2 km" -> 3.2)
          const distanceMatch = place.distanceFromUser.match(/(\d+(\.\d+)?)/)
          if (!distanceMatch) return true

          const distance = Number.parseFloat(distanceMatch[0])
          return distance <= 5
        })

        console.log(`Found ${places.length} mid-altitude places within 5km`)

        revalidatePath("/dashboard/navigation")
        return {
          success: true,
          places,
        }
      }

      // If all parsing attempts failed, return sample data
      console.error("Failed to parse JSON from Gemini API response")
      return {
        success: false,
        places: getSamplePlaces(latitude, longitude),
        error: "Failed to parse response from Gemini API",
      }
    } catch (apiError) {
      console.error("API error:", apiError)
      return {
        success: true,
        places: getSamplePlaces(latitude, longitude),
      }
    }
  } catch (error) {
    console.error("Error finding mid altitude places:", error)
    return {
      success: true,
      places: getSamplePlaces(latitude, longitude),
    }
  }
}

// Helper function to get sample places
function getSamplePlaces(latitude: number, longitude: number): MidAltitudePlace[] {
  return [
    {
      id: "1",
      name: "Scenic Ridge",
      elevation: "850 ft",
      status: "Accessible",
      risk: "Low",
      coordinates: { lat: latitude + 0.01, lng: longitude + 0.01 },
      description: "A gentle hill with panoramic views of the surrounding area.",
      distanceFromUser: "1.2 km",
    },
    {
      id: "2",
      name: "Lookout Point",
      elevation: "1,240 ft",
      status: "Caution",
      risk: "Medium",
      coordinates: { lat: latitude + 0.02, lng: longitude - 0.01 },
      description: "A moderate climb with rocky terrain and beautiful vistas.",
      distanceFromUser: "2.8 km",
    },
    {
      id: "3",
      name: "Valley Overlook",
      elevation: "1,120 ft",
      status: "Dangerous",
      risk: "High",
      coordinates: { lat: latitude - 0.01, lng: longitude + 0.02 },
      description: "A challenging ascent with steep cliffs and difficult terrain.",
      distanceFromUser: "3.5 km",
    },
  ]
}

