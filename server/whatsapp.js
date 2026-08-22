const formatUserId = (id) => {
  const num = parseInt(id, 10);
  if (isNaN(num)) return `MBQ${id}`;
  return `MBQ${String(num).padStart(3, '0')}`;
};

const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  // Remove all non-digit characters
  let digits = phone.toString().replace(/\D/g, '');
  // Default to India (+91) if a 10 digit number is provided
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits;
};

const sendWhatsAppTemplate = async (toPhone, templateName, parameters = []) => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn(`WhatsApp credentials missing. Skipping template ${templateName} to ${toPhone}`);
    return;
  }

  const formattedPhone = formatPhoneNumber(toPhone);
  if (!formattedPhone) {
    console.warn(`Invalid phone number provided for WhatsApp template ${templateName}`);
    return;
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: 'en'
      }
    }
  };

  if (parameters.length > 0) {
    payload.template.components = [
      {
        type: 'body',
        parameters: parameters.map(param => (
          typeof param === 'object' && param !== null
            ? param
            : { type: 'text', text: String(param) }
        ))
      }
    ];
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`Error sending WhatsApp template ${templateName}:`, data);
      return;
    }
    console.log(`WhatsApp template ${templateName} sent to ${formattedPhone}`, data);
  } catch (error) {
    console.error(`Exception while sending WhatsApp template ${templateName}:`, error);
  }
};

const sendWhatsAppOtp = async (phone, otp) => {
  if (!phone) return;
  // {{1}} = otp
  await sendWhatsAppTemplate(phone, 'order_status', [otp, 'dummy2', 'dummy3', 'dummy4']);
};

const getNameWithTests = (user) => {
  const firstName = (user && user.full_name) ? String(user.full_name).split(' ')[0] : (user && user.username) ? String(user.username) : 'User';
  const tests = (user && user.gene_type) ? String(user.gene_type) : 'Test';
  return `${firstName} (${tests})`;
};

const sendWhatsAppSampleDispatched = async (user) => {
  if (!user || !user.phone) return;
  await sendWhatsAppTemplate(user.phone, 'mbq_sample_collected', [
    { type: 'text', text: getNameWithTests(user), parameter_name: 'name' }
  ]);
};

const sendWhatsAppReportGenerated = async (user) => {
  if (!user || !user.phone) return;
  await sendWhatsAppTemplate(user.phone, 'mbq_report_generated', [
    { type: 'text', text: getNameWithTests(user), parameter_name: 'name' }
  ]);
};

const sendWhatsAppReportReady = async (user) => {
  if (!user || !user.phone) return;
  await sendWhatsAppTemplate(user.phone, 'mbq_report_ready', [
    { type: 'text', text: getNameWithTests(user), parameter_name: 'name' }
  ]);
};

const sendWhatsAppSurveyRequested = async (user, testName) => {
  if (!user || !user.phone) return;
  // If a specific testName is provided (e.g. they only submitted one panel), 
  // but they requested all tests to be listed, user.gene_type has all tests.
  const tests = (user && user.gene_type) ? String(user.gene_type) : (testName ? String(testName) : 'Test');
  const firstName = (user && user.full_name) ? String(user.full_name).split(' ')[0] : (user && user.username) ? String(user.username) : 'User';
  const nameWithTest = `${firstName} (${tests})`;
  await sendWhatsAppTemplate(user.phone, 'mbq_survey_requested', [
    { type: 'text', text: nameWithTest, parameter_name: 'name' }
  ]);
};

module.exports = {
  sendWhatsAppOtp,
  sendWhatsAppSampleDispatched,
  sendWhatsAppReportGenerated,
  sendWhatsAppReportReady,
  sendWhatsAppSurveyRequested
};
