import { useEffect, useState } from 'react';
import { supabase } from '../services/pixService';
import { RefreshCw } from 'lucide-react';

interface CampaignMetrics {
  source: string;
  medium?: string;
  campaign?: string;
  transactions: number;
  completed: number;
  pending: number;
  failed: number;
  totalRevenue: number;
  conversionRate: number;
}

export default function CampaignAnalytics() {
  const [loading, setLoading] = useState(true);
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetrics[]>([]);
  const [groupBy, setGroupBy] = useState<'source' | 'campaign' | 'medium'>('campaign');

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*');

      if (fetchError) throw new Error(fetchError.message);

      if (!data || data.length === 0) {
        setCampaignMetrics([]);
        setLoading(false);
        return;
      }

      const metricsMap = new Map<string, CampaignMetrics>();

      data.forEach((transaction: any) => {
        let groupKey = '';
        let displaySource = '';
        let displayMedium: string | undefined;
        let displayCampaign: string | undefined;

        if (groupBy === 'source') {
          groupKey = transaction.utm_source || transaction.src || 'Direct';
          displaySource = groupKey;
        } else if (groupBy === 'medium') {
          groupKey = transaction.utm_medium || 'Unknown Medium';
          displaySource = transaction.utm_source || 'Unknown Source';
          displayMedium = groupKey;
        } else {
          groupKey = transaction.utm_campaign || 'No Campaign';
          displaySource = transaction.utm_source || 'Unknown Source';
          displayMedium = transaction.utm_medium;
          displayCampaign = groupKey;
        }

        if (!metricsMap.has(groupKey)) {
          metricsMap.set(groupKey, {
            source: displaySource,
            medium: displayMedium,
            campaign: displayCampaign,
            transactions: 0,
            completed: 0,
            pending: 0,
            failed: 0,
            totalRevenue: 0,
            conversionRate: 0,
          });
        }

        const metrics = metricsMap.get(groupKey)!;
        metrics.transactions++;

        if (transaction.status === 'completed' || transaction.status === 'authorized' || transaction.status === 'approved') {
          metrics.completed++;
          metrics.totalRevenue += parseFloat(transaction.amount) || 0;
        } else if (transaction.status === 'pending') {
          metrics.pending++;
        } else {
          metrics.failed++;
        }
      });

      metricsMap.forEach((metrics) => {
        metrics.conversionRate = metrics.transactions > 0
          ? (metrics.completed / metrics.transactions) * 100
          : 0;
      });

      const sortedMetrics = Array.from(metricsMap.values()).sort(
        (a, b) => b.totalRevenue - a.totalRevenue
      );

      setCampaignMetrics(sortedMetrics);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching campaign metrics:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [groupBy]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Desempenho por Campanha</h2>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setGroupBy('source')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  groupBy === 'source'
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Por Source
              </button>
              <button
                onClick={() => setGroupBy('medium')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  groupBy === 'medium'
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Por Medium
              </button>
              <button
                onClick={() => setGroupBy('campaign')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  groupBy === 'campaign'
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Por Campaign
              </button>
            </div>
            <button
              onClick={fetchMetrics}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Atualizar dados"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                {groupBy === 'source' ? 'Source' : groupBy === 'medium' ? 'Medium' : 'Campaign'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Transações
              </th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Completadas
              </th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Pendentes
              </th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Taxa Conv.
              </th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                Receita
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {campaignMetrics.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                  Nenhuma transação encontrada
                </td>
              </tr>
            ) : (
              campaignMetrics.map((metrics, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {groupBy === 'source' ? metrics.source : groupBy === 'medium' ? metrics.medium : metrics.campaign}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                    {metrics.source}
                  </td>
                  <td className="px-6 py-4 text-sm text-center text-gray-900 font-medium">
                    {metrics.transactions}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[32px] h-6 px-2.5 rounded-md text-sm font-semibold bg-green-100 text-green-700">
                      {metrics.completed}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[32px] h-6 px-2.5 rounded-md text-sm font-semibold bg-yellow-100 text-yellow-700">
                      {metrics.pending}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className={`font-semibold ${
                      metrics.conversionRate >= 20
                        ? 'text-green-600'
                        : metrics.conversionRate >= 10
                        ? 'text-yellow-600'
                        : metrics.conversionRate > 0
                        ? 'text-orange-600'
                        : 'text-red-600'
                    }`}>
                      {metrics.conversionRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 whitespace-nowrap">
                    {formatCurrency(metrics.totalRevenue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
