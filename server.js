import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

app.post('/api/gemini', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured on server.' });
  }

  const title = (req.body?.title || '').trim();
  if (!title) {
    return res.status(400).json({ error: 'Missing title for Gemini generation.' });
  }

  const prompt = `You are a Senior Sustainable Finance Analyst. Generate professional, concise, technically-accurate entries for a career portfolio.
Webinar/Course Title: "${title}"

Return a strictly formatted JSON response containing exactly these two keys (nothing else):
{
  "takeaways": "Give a paragraph of 3-4 sentences outlining key takeaways. Mention standard sustainable finance terms like taxonomy alignment, ESG standards (ISSB/ESRS), carbon accounting, green bonds, transition policies, physical risk, transition risk, or regional regulatory aspects.",
  "analysis": "Give a paragraph of 2-3 sentences outlining the Analytical Application. Explain how a junior analyst can apply this in real-world credit risk assessment, investment vetting, structuring green finance instruments, or ESG transition plan audits."
}
IMPORTANT: Output ONLY the raw JSON block without markdown wrappers. No backticks.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const result = await response.json();
    if (!response.ok) {
      const detail = result?.error || JSON.stringify(result);
      console.error('Gemini proxy error:', response.status, detail);
      return res.status(response.status).json({ error: 'Gemini API request failed.', detail });
    }

    const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text || result?.candidates?.[0]?.content?.[0]?.parts?.[0]?.text || '';
    if (!responseText) {
      console.error('Gemini invalid response shape', result);
      return res.status(502).json({ error: 'Invalid response from Gemini API.' });
    }

    const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (error) {
      console.error('Gemini returned non-JSON content:', cleaned);
      return res.status(502).json({ error: 'Gemini returned non-JSON content.', detail: cleaned });
    }

    if (!parsed.takeaways || !parsed.analysis) {
      console.error('Gemini returned missing fields:', parsed);
      return res.status(502).json({ error: 'Gemini response missing expected fields.', detail: parsed });
    }

    return res.json(parsed);
  } catch (error) {
    console.error('Gemini proxy failure:', error);
    return res.status(500).json({ error: 'Gemini proxy failed.', detail: error.message });
  }
});

// Direct any unrecognized route to index.html
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
