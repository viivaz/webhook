import { NextResponse, NextRequest } from "next/server";
import { Payment } from "mercadopago";
import mpClient, { verifyMercadoPagoSignature } from "@/app/lib/mercado-pago";
import { google } from "googleapis";

const sheetRange = "Página1!A2";

async function appendToSheet(values: any[]) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: sheetRange,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    verifyMercadoPagoSignature(request);
    const body = await request.json();

    const { type, data } = body;

    if (type === "payment" && data?.id) {
      const payment = new Payment(mpClient);
      const paymentData = await payment.get({ id: data.id });

      if (
        paymentData.status === "approved" ||
        paymentData.date_approved !== null
      ) {
        const payer = paymentData.payer || {};
        const address = payer.address || {};
        const phone = payer.phone || {};
        const identification = payer.identification || {};
        const card = paymentData.card || {};
        const cardholder = card.cardholder || {};
        const items = paymentData.additional_info?.items || [];

        // Junta todos os produtos em uma string
        const productsSummary = items.map((item: any) => item.title).join(" | ");

        const valores = [[
          paymentData.id ?? "",
          paymentData.status ?? "",
          paymentData.payment_type_id ?? "",
          paymentData.payment_method_id ?? "",
          paymentData.transaction_amount ?? "",
          paymentData.date_created ?? "",
          paymentData.date_approved ?? "",

          payer.email ?? "",
          payer.first_name ?? "",
          payer.last_name ?? "",
          identification.type ?? "",
          identification.number ?? "",
          phone.area_code ?? "",
          phone.number ?? "",

          address.street_name ?? "",
          address.street_number ?? "",
          address.zip_code ?? "",

          productsSummary,
          paymentData.installments ?? "",
          paymentData.transaction_details?.net_received_amount ?? "",
          paymentData.transaction_details?.total_paid_amount ?? "",
          paymentData.statement_descriptor ?? "",
          paymentData.order?.id ?? "",

          card.bin ?? "",
          card.last_four_digits ?? "",
          cardholder.name ?? ""
        ]];

        await appendToSheet(valores);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Error handling webhook:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
