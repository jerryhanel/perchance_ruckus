import { state } from '../state.js';
import { db } from '../db.js';
import { addInterimMessage } from '../ui.js';
import { getSystemTimeContext, getUserLocation, fetchWeather, decodeWeatherCode } from '../utils.js';

export async function executeWeatherToolLoop(userMessage, conversationContext) {
  const location = await getUserLocation();
  if (!location) {
    return 'Unable to access location. Please enable location services in your browser to get weather information.';
  }

  const weatherData = await fetchWeather(location.latitude, location.longitude);
  if (!weatherData) {
    return 'Failed to fetch weather data. Please try again.';
  }

  const tools = {
    get_current_weather: {
      description: 'Get current weather conditions',
      args: '(no args)',
      fn: async () => {
        const current = weatherData.current;
        return JSON.stringify({
          temperature: current.temperature_2m,
          condition: decodeWeatherCode(current.weather_code),
          humidity: current.relative_humidity_2m + '%',
          wind_speed: current.wind_speed_10m + ' km/h',
          timezone: weatherData.timezone
        });
      }
    },
    get_weather_forecast: {
      description: 'Get weather forecast for the next 7 days',
      args: '{"days": number of days to forecast (1-7)}',
      fn: async (args) => {
        const daysToForecast = Math.min(args.days || 7, 7);
        const forecast = [];
        for (let i = 0; i < daysToForecast; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i);
          forecast.push({
            date: date.toLocaleDateString(),
            condition: decodeWeatherCode(weatherData.daily.weather_code[i]),
            high: weatherData.daily.temperature_2m_max[i],
            low: weatherData.daily.temperature_2m_min[i],
            precipitation: weatherData.daily.precipitation_sum[i] + ' mm'
          });
        }
        return JSON.stringify(forecast);
      }
    }
  };

  const historyBlock = conversationContext
    ? `Here is the conversation so far:\n${conversationContext}\n\n`
    : '';
  const toolLoop = window.root.buildAiToolLoop();

  try {
    const announceSettings = await db.misc.get('settings') || {};
    const result = await toolLoop.runToolLoop({
      instruction: `You are a weather assistant. ${getSystemTimeContext()}\n\nIMPORTANT: Weather data is ONLY available for the user's current location in Nova Scotia, Canada. You CANNOT look up weather for other cities or regions. If the user asks about weather somewhere else, politely explain that you can only provide weather for Nova Scotia.\n\n${historyBlock}User Query: ${userMessage}`,
      tools,
      maxRounds: 5,
      onRespond: addInterimMessage,
      forceInitialRespond: announceSettings.announce_tool_use !== false,
      signals: state.activeSignals
    });
    return result.answer || 'No response generated';
  } catch (error) {
    console.error('Weather tool loop error:', error);
    return `Error getting weather: ${error.message}`;
  }
}
