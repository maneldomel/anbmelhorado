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
    const data = body?.data;

    const nome = data?.customer?.name || "Cliente";
    const valor = (data?.amount || 0) / 100;

    console.log("Webhook recebido:", { status, nome, valor });

    if (status === "paid") {
      console.log("Enviando notificação de pagamento aprovado...");
      await fetch(PUSH_PAID, {
        method: "POST"
      });
      console.log("Notificação de pagamento aprovado enviada");
    } else if (status === "waiting_payment") {
      console.log("Enviando notificação de pagamento pendente...");
      await fetch(PUSH_PENDING, {
        method: "POST"
      });
      console.log("Notificação de pagamento pendente enviada");
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