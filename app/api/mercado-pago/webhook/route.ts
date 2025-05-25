// app/api/mercadopago-webhook/route.js

import { NextResponse } from "next/server";
import { Payment } from "mercadopago";
import mpClient, { verifyMercadoPagoSignature } from "@/app/lib/mercado-pago";
import { google } from "googleapis";

// 🔐 Suas credenciais (coloque essas variáveis no painel de Environment Variables da Vercel)
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const sheetRange = "Página1!A2";

async function appendToSheet(values: any[][])  {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REFRESH_TOKEN
  );

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values
    }
  });
}

export async function POST(request) {
  try {
    verifyMercadoPagoSignature(request);

    const body = await request.json();
    const { type, data } = body;

    if (type === "payment") {
      const payment = new Payment(mpClient);
      const paymentData = await payment.get({ id: data.id });

      if (
        paymentData.status === "approved" ||
        paymentData.date_approved !== null
      ) {
        const p = paymentData.payer;
        const valores = [[
          paymentData.id,
          paymentData.external_reference,
          paymentData.status,
          paymentData.payment_type_id,
          paymentData.payment_method_id,
          paymentData.transaction_amount,
          paymentData.net_received_amount,
          paymentData.date_created,
          p?.name || "",
          p?.surname || "",
          p?.email || "",
          `${p?.phone?.area_code || ""}${p?.phone?.number || ""}`,
          p?.identification?.number || "",
          p?.address?.street_name || "",
          p?.address?.street_number || "",
          p?.address?.zip_code || ""
        ]];

        await appendToSheet(valores);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error("❌ Webhook handler failed:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
