import { serve } from "https://deno.land/std@0.195.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@suds.app";

interface SignupEventPayload {
  record: {
    id: string;
    email: string;
    raw_user_meta_data?: {
      username?: string;
    };
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: SignupEventPayload = await req.json();
    const { email, raw_user_meta_data, id: userId } = payload.record;
    const username = raw_user_meta_data?.username || "Sudser";

    console.log(`Sending signup email to ${email} (${username})`);

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: email,
        subject: "Welcome to Suds! 🍺",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #92400e;">Welcome to Suds, ${username}! 🍺</h1>
            <p>Great to have you on board! We're excited to help you track your drinks and connect with friends.</p>

            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #92400e; margin-top: 0;">Get Started:</h3>
              <ul style="color: #78350f;">
                <li>Complete your profile with your height, weight, age, and name</li>
                <li>Start logging your drinks and tracking your daily intake</li>
                <li>Follow friends and see their activity</li>
                <li>Discover new drinks and breweries</li>
              </ul>
            </div>

            <p style="color: #666;">If you have any questions or need help, reach out to our support team.</p>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; color: #999; font-size: 12px;">
              <p>© 2026 Suds. All rights reserved.</p>
              <p>This email was sent to ${email} because you signed up for Suds.</p>
            </div>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      throw new Error(`Failed to send email: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Email sent successfully:", data.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Welcome email sent",
        emailId: data.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
