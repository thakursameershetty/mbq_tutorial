require('dotenv').config();

async function test() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  
  const payload = {
    messaging_product: 'whatsapp',
    to: '918985636570',
    type: 'template',
    template: {
      name: 'mbq_sample_collected',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'TestUser', parameter_name: 'name' }
          ]
        }
      ]
    }
  };

  const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  console.log(await response.json());
}
test();
