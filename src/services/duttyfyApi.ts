import { createClient } from '@supabase/supabase-js';
import type { CreateTransactionRequest, Transaction } from './genesysApi';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export interface DuttyfyConfig {
  apiUrl: string;
  encryptedKey: string;
}

export async function createDuttyfyTransaction(
  config: DuttyfyConfig,
  data: CreateTransactionRequest
): Promise<Transaction> {
  try {
    console.log('Creating Duttyfy transaction with amount:', data.amount);

    const payload = {
      cpf: data.cpf,
      amount: data.amount,
      pixKey: data.pixKey || '',
      productName: data.productName,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      encryptedKey: config.encryptedKey,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmTerm: data.utmTerm,
      utmContent: data.utmContent,
      src: data.src,
    };

    const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/duttyfy-create-transaction`;

    console.log('Calling Duttyfy Edge Function:', edgeFunctionUrl);

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('Edge Function Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Edge Function error:', errorData);
      throw new Error(errorData.error || 'Failed to create Duttyfy transaction');
    }

    const transaction = await response.json();
    console.log('Transaction created via Edge Function:', transaction);

    if (data.createReceipt !== false) {
      await supabase
        .from('payment_receipts')
        .insert({
          transaction_id: transaction.id,
          cpf: data.cpf,
          customer_name: data.customerName || 'Cliente',
          amount: data.amount,
          status: 'pending_receipt',
        })
        .select()
        .single();
    }

    return transaction;
  } catch (error: any) {
    console.error('Error creating Duttyfy transaction:', error);
    throw error;
  }
}

export async function getDuttyfyTransactionStatus(
  config: DuttyfyConfig,
  transactionId: string
): Promise<string> {
  try {
    console.log('Checking Duttyfy transaction status:', transactionId);

    const response = await fetch(`${config.apiUrl}/${config.encryptedKey}?transactionId=${transactionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Duttyfy status check error:', errorText);
      throw new Error(`Duttyfy API error: ${response.status} - ${errorText}`);
    }

    const duttyfyResponse = await response.json();
    console.log('Duttyfy transaction status:', duttyfyResponse);

    const status = duttyfyResponse.status || 'pending';

    const statusMap: Record<string, string> = {
      'PENDING': 'pending',
      'COMPLETED': 'approved',
      'FAILED': 'failed',
      'CANCELLED': 'cancelled',
    };

    return statusMap[status.toUpperCase()] || 'pending';
  } catch (error: any) {
    console.error('Error checking Duttyfy transaction status:', error);
    throw error;
  }
}
