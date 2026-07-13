import twilio from "twilio";

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials not configured");
  return twilio(sid, token);
}

export async function sendSMS(to: string, body: string): Promise<string> {
  const client = getClient();
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error("TWILIO_PHONE_NUMBER not configured");

  const msg = await client.messages.create({ from, to, body });
  return msg.sid;
}

export async function sendWhatsApp(to: string, body: string): Promise<string> {
  const client = getClient();
  const from = process.env.TWILIO_WHATSAPP_NUMBER;
  if (!from) throw new Error("TWILIO_WHATSAPP_NUMBER not configured");

  const msg = await client.messages.create({
    from: `whatsapp:${from}`,
    to: `whatsapp:${to}`,
    body,
  });
  return msg.sid;
}

export async function sendInterviewReminder(opts: {
  candidateName: string;
  candidatePhone: string;
  interviewDateTime: string;
  jobTitle: string;
  companyName: string;
  via: "sms" | "whatsapp";
}): Promise<string> {
  const body = `Hi ${opts.candidateName}, reminder: your interview for ${opts.jobTitle} at ${opts.companyName} is scheduled on ${opts.interviewDateTime}. Good luck!`;
  return opts.via === "whatsapp" ? sendWhatsApp(opts.candidatePhone, body) : sendSMS(opts.candidatePhone, body);
}

export async function sendOfferNotification(opts: {
  candidateName: string;
  candidatePhone: string;
  jobTitle: string;
  companyName: string;
  via: "sms" | "whatsapp";
}): Promise<string> {
  const body = `Congratulations ${opts.candidateName}! You have received an offer for ${opts.jobTitle} at ${opts.companyName}. Please log in to the portal to review your offer.`;
  return opts.via === "whatsapp" ? sendWhatsApp(opts.candidatePhone, body) : sendSMS(opts.candidatePhone, body);
}
