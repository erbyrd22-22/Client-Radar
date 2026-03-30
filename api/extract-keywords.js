export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { description } = req.body;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `Extract 3 to 5 short job title keywords from this description. Return ONLY a JSON array of strings like ["RIA","CFP","wealth manager"]. No explanation. Description: ${description}`
        }]
      })
    });

    const data = await response.json();
    const keywords = JSON.parse(data.content[0].text.trim());
    res.status(200).json({ keywords });
  } catch (err) {
    console.error('AI extraction error:', err);
    res.status(500).json({ error: err.message });
  }
}
