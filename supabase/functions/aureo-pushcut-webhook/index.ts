import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PUSH_PAID = "https://api.pushcut.io/RQXs4um6IEk1tr-Y3VHki/notifications/Pagamento%20aprovado%20";
const PUSH_PENDING = "https://api.pushcut.io/58TFXTcu8DSqjQ6mkCrz_/notifications/Pix%20gerado";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const status = body?.data?.status;

    console.log("Webhook recebido:", { status });

    if (status === "paid") {
      console.log("Enviando notificação de pagamento aprovado...");
      const pushResponse = await fetch(PUSH_PAID, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });
      console.log("Resposta Pushcut (PAID):", pushResponse.status, await pushResponse.text());
    } else if (status === "waiting_payment") {
      console.log("Enviando notificação de pagamento pendente...");
      const pushResponse = await fetch(PUSH_PENDING, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });
      console.log("Resposta Pushcut (PENDING):", pushResponse.status, await pushResponse.text());
    } else {
      console.log("Status ignorado:", status);
    }

    return new Response(
      JSON.stringify({ status: "ok" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro ao processar webhook:", error.message);
    return new Response(
      JSON.stringify({ status: "ok", error: error.message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});