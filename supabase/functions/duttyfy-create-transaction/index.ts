import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateTransactionRequest {
  cpf: string;
  amount: number;
  pixKey: string;
  productName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  src?: string;
  sck?: string;
  productId?: string;
  userAgent?: string;
  userIp?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: settings, error: settingsError } = await supabase
      .from("pix_provider_settings")
      .select("*")
      .eq("provider", "duttyfy")
      .eq("is_active", true)
      .maybeSingle();

    if (settingsError || !settings) {
      console.error("Duttyfy settings not found:", settingsError);
      return new Response(
        JSON.stringify({ error: "Duttyfy provider not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!settings.api_key) {
      console.error("Duttyfy Encrypted Key missing");
      return new Response(
        JSON.stringify({ error: "Duttyfy Encrypted Key must be configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data: CreateTransactionRequest = await req.json();

    const cleanCpf = data.cpf.replace(/\D/g, "");
    const amountInCents = Math.round(data.amount * 100);

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existingTransaction, error: checkError } = await supabase
      .from("transactions")
      .select("*")
      .eq("cpf", cleanCpf)
      .eq("amount", data.amount)
      .eq("provider", "duttyfy")
      .in("status", ["pending", "authorized", "approved", "completed"])
      .gte("created_at", fiveMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingTransaction && !checkError) {
      console.log("Reusing existing Duttyfy transaction:", existingTransaction.id);
      return new Response(JSON.stringify(existingTransaction), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalRef = `duttyfy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let utmParams = "";
    if (data.utmSource || data.utmMedium || data.utmCampaign || data.utmTerm || data.utmContent) {
      const utmParts = [];
      if (data.utmSource) utmParts.push(`utm_source=${data.utmSource}`);
      if (data.utmMedium) utmParts.push(`utm_medium=${data.utmMedium}`);
      if (data.utmCampaign) utmParts.push(`utm_campaign=${data.utmCampaign}`);
      if (data.utmTerm) utmParts.push(`utm_term=${data.utmTerm}`);
      if (data.utmContent) utmParts.push(`utm_content=${data.utmContent}`);
      utmParams = utmParts.join("&");
    }

    const payload = {
      amount: amountInCents,
      description: data.productName || "Pagamento via Pix",
      customer: {
        name: data.customerName || "Cliente",
        document: cleanCpf,
        email: data.customerEmail || `${cleanCpf}@cliente.com`,
        phone: data.customerPhone || "11999999999",
      },
      item: {
        title: data.productName || "Produto Digital",
        price: amountInCents,
        quantity: 1,
      },
      paymentMethod: "PIX",
      ...(utmParams && { utm: utmParams }),
    };

    console.log("Creating Duttyfy transaction:", {
      url: `${settings.api_url}/${settings.api_key}`,
      hasEncryptedKey: !!settings.api_key,
    });

    console.log("Duttyfy payload:", JSON.stringify(payload, null, 2));

    let response: Response | undefined;
    let lastError: any;
    const maxRetries = 3;
    const baseDelay = 2000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1}/${maxRetries}: Calling ${settings.api_url}/${settings.api_key}`);

        response = await fetch(`${settings.api_url}/${settings.api_key}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        console.log(`Duttyfy response status (attempt ${attempt + 1}):`, response.status);

        if (response.status === 429) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Rate limited. Retrying in ${delay}ms...`);

          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        if (response.ok || response.status !== 429) {
          break;
        }
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed with error:`, error);
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Request failed. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!response) {
      console.error("All retry attempts failed. Last error:", lastError);
      return new Response(
        JSON.stringify({
          error: "Falha ao conectar com o processador de pagamentos",
          details: lastError?.message || String(lastError)
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const responseText = await response.text();
    console.log("Duttyfy raw response:", responseText);
    console.log("Duttyfy response status:", response.status);
    console.log("Duttyfy response ok:", response.ok);

    if (!response.ok) {
      console.error("Duttyfy error response:", responseText);

      let error;
      try {
        error = JSON.parse(responseText);
      } catch {
        error = { message: responseText || "Failed to create Duttyfy transaction" };
      }

      return new Response(
        JSON.stringify({ 
          error: error.message || error.error || "Failed to create Duttyfy transaction",
          details: error,
          status: response.status
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const duttyfyResponse = JSON.parse(responseText);
    console.log("Duttyfy transaction created:", JSON.stringify(duttyfyResponse, null, 2));

    const transactionId = duttyfyResponse.transactionId || externalRef;
    const qrCodeText = duttyfyResponse.pixCode || "";
    const qrCodeImage = qrCodeText
      ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeText)}`
      : "";

    const { data: transaction, error: dbError } = await supabase
      .from("transactions")
      .insert({
        genesys_transaction_id: transactionId.toString(),
        provider: "duttyfy",
        cpf: cleanCpf,
        amount: data.amount,
        pix_key: data.pixKey,
        qr_code: qrCodeText,
        qr_code_image: qrCodeImage,
        status: "pending",
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        utm_source: data.utmSource,
        utm_medium: data.utmMedium,
        utm_campaign: data.utmCampaign,
        utm_term: data.utmTerm,
        utm_content: data.utmContent,
        src: data.src,
        sck: data.sck,
        product_id: data.productId,
        user_agent: data.userAgent,
        user_ip: data.userIp,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Database error", details: dbError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Transaction saved to database:", transaction.id);

    return new Response(JSON.stringify(transaction), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error creating Duttyfy transaction:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});