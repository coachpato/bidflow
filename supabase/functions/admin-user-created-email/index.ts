import nodemailer from "nodemailer";

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const smtpUser = requiredEnv("GMAIL_SMTP_USER");
const smtpAppPassword = requiredEnv("GMAIL_SMTP_APP_PASSWORD");
const adminEmail = requiredEnv("ADMIN_EMAIL");
const webhookSecret = requiredEnv("ADMIN_USER_CREATED_WEBHOOK_SECRET");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: smtpUser,
    pass: smtpAppPassword,
  },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return replacements[character] ?? character;
  });

const redactRecord = (record: Record<string, unknown>) => {
  const redacted = { ...record };

  for (const key of ["password", "verificationToken", "verificationTokenExpiresAt"]) {
    if (key in redacted) {
      redacted[key] = "[redacted]";
    }
  }

  return redacted;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  if (request.headers.get("x-webhook-secret") !== webhookSecret) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const payload = await request.json();

    if (payload.type !== "INSERT") {
      return jsonResponse({ ok: true, ignored: true });
    }

    const record = redactRecord(payload.record ?? {});
    const userLabel = record.email ?? record.name ?? record.id ?? "unknown user";
    const recordJson = JSON.stringify(record, null, 2);

    const info = await transporter.sendMail({
      from: `"Bid360 Admin Alerts" <${smtpUser}>`,
      to: adminEmail,
      subject: `New Bid360 user: ${userLabel}`,
      text: [
        'A new row was inserted into public."user".',
        "",
        recordJson,
      ].join("\n"),
      html: [
        "<h2>New Bid360 user</h2>",
        '<p>A new row was inserted into <code>public."user"</code>.</p>',
        `<pre>${escapeHtml(recordJson)}</pre>`,
      ].join(""),
    });

    console.log(
      JSON.stringify({
        ok: true,
        messageId: info.messageId,
        user: userLabel,
      }),
    );

    return jsonResponse({ ok: true, messageId: info.messageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("admin-user-created-email failed", message);

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
