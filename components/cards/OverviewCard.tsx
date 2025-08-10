import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Users, Building2, Calendar, User } from 'lucide-react';
import { getCompanyProfile } from '@/api/financialModelingPrep';

interface OverviewCardProps {
  selectedStock: any;
}

type Profile = Record<string, any>;

function normalizeProfile(p: Profile | null): Profile {
  if (!p) return {};
  return {
    // Básicos
    symbol: p.symbol,
    companyName: p.companyName,
    sector: p.sector,
    industry: p.industry,
    country: p.country,
    description: p.description,
    ceo: p.ceo,
    fullTimeEmployees: p.fullTimeEmployees,
    ipoDate: p.ipoDate,
    exchange: p.exchange,
    exchangeFullName: p.exchangeShortName ?? p.exchangeFullName,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    phone: p.phone,
    isEtf: p.isEtf,
    isActivelyTrading: p.isActivelyTrading,
    cik: p.cik,
    isin: p.isin,
    cusip: p.cusip,
    currency: p.currency,

    // Números / mercado
    price: typeof p.price === 'number' ? p.price : Number(p.price) || undefined,
    marketCap: p.mktCap ?? p.marketCap,
    beta: typeof p.beta === 'number' ? p.beta : Number(p.beta) || undefined,
    lastDividend: p.lastDiv ?? p.lastDividend,
    range: p.range,

    // Cambios y volúmenes (FMP suele dar changesPercentage como "1.23%")
    change: typeof p.changes === 'number' ? p.changes
           : typeof p.change === 'number' ? p.change
           : (p.changes ? Number(p.changes) : undefined),

    changePercentage:
      typeof p.changesPercentage === 'number' ? p.changesPercentage
      : typeof p.changePercentage === 'number' ? p.changePercentage
      : (typeof p.changesPercentage === 'string'
          ? Number(p.changesPercentage.replace('%',''))
          : (typeof p.changePercentage === 'string'
              ? Number(p.changePercentage.replace('%',''))
              : undefined)),

    volume: p.volume,
    averageVolume: p.volAvg ?? p.averageVolume,

    // Website limpio
    website: typeof p.website === 'string' ? p.website.trim() : undefined,
    image: p.image,
  };
}

function formatLargeNumber(num?: number) {
  if (!num) return 'N/A';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9)  return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6)  return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3)  return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toLocaleString()}`;
}

function formatPercentage(value?: number) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export default function OverviewCard({ selectedStock }: OverviewCardProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchCompanyProfile = async () => {
      if (!selectedStock?.symbol) return;
      setLoading(true);
      setError(null);
      try {
        const raw = await getCompanyProfile(selectedStock.symbol);
        if (!active) return;
        setProfile(normalizeProfile(raw));
      } catch (err) {
        console.error('Error fetching company profile:', err);
        if (active) setError('Error al cargar el perfil de la empresa');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchCompanyProfile();
    return () => { active = false; };
  }, [selectedStock?.symbol]);

  if (loading) {
    return (
      <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-400">Cargando perfil de la empresa...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-red-400">{error}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = profile || {};

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm hover:bg-gray-800/50 transition-colors cursor-pointer">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-400 text-lg flex items-center justify-between">
              <div className="text-gray-400 flex items-center gap-2">
                {data.symbol} - {typeof data.price === 'number' ? `$${Math.round(data.price)}` : 'N/A'}
              </div>
              {data.image && (
                <img 
                  src={data.image} 
                  alt={`Logo de ${data.companyName || data.symbol}`}
                  className="w-8 h-8 object-contain rounded"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">Cap. Mercado</span>
                </div>
                <p className="text-lg font-semibold text-green-400">
                  {formatLargeNumber(data.marketCap)}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">Beta</span>
                </div>
                <p className="text-lg font-semibold text-green-400">
                  {typeof data.beta === 'number' ? data.beta.toFixed(2) : 'N/A'}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">Empleados</span>
                </div>
                <p className="text-lg font-semibold text-green-400">
                  {data.fullTimeEmployees?.toLocaleString() || 'N/A'}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">CEO</span>
                </div>
                <p className="text-lg font-semibold text-green-400">
                  {data.ceo || 'N/A'}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-700/50">
              <p className="text-xs text-gray-500 text-center">
                Haz clic para ver detalles completos
              </p>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="bg-gray-900 border-gray-700 max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-green-400 text-xl flex items-center gap-2">
            {data.image ? (
                <img 
                  src={data.image} 
                  alt={`Logo de ${data.companyName || data.symbol}`}
                  className="w-5 h-5 object-contain rounded"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <Building2 className="w-5 h-5" />
              )}
            {data.companyName || selectedStock?.symbol || 'Empresa'} - Overview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información de la Empresa */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
            <h3 className="text-green-400 text-lg font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Información de la Empresa
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Nombre:</span>
                  <span className="text-green-400 font-medium">
                    {data.companyName || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sector:</span>
                  <span className="text-green-400">{data.sector || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Industria:</span>
                  <span className="text-green-400">{data.industry || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">CEO:</span>
                  <span className="text-green-400">{data.ceo || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fundada (IPO):</span>
                  <span className="text-green-400">{data.ipoDate || 'N/A'}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Empleados:</span>
                  <span className="text-green-400">
                    {data.fullTimeEmployees?.toLocaleString() || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sitio web:</span>
                  <span className="text-green-400">
                    {data.website ? (
                      <a
                        href={data.website.startsWith('http') ? data.website : `https://${data.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-green-300 underline"
                      >
                        {data.website.replace(/^https?:\/\//, '').trim()}
                      </a>
                    ) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Intercambio:</span>
                  <span className="text-green-400">{data.exchange || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">País:</span>
                  <span className="text-green-400">{data.country || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Dirección:</span>
                  <span className="text-green-400 text-sm">
                    {data.address && data.city && data.state
                      ? `${data.address}, ${data.city}, ${data.state} ${data.zip || ''}`.trim()
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Métricas */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
            <h3 className="text-green-400 text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Métricas Financieras Clave
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">Valoración</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cap. de Mercado:</span>
                    <span className="text-green-400 font-mono">
                      {formatLargeNumber(data.marketCap)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Precio Actual:</span>
                    <span className="text-green-400 font-mono">
                      {typeof data.price === 'number' ? `$${data.price.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Moneda:</span>
                    <span className="text-green-400 font-mono">{data.currency || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">Rendimiento</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cambio Diario:</span>
                    <span className={`font-mono ${Number(data.change) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {Number.isFinite(Number(data.change)) ? `$${Number(data.change).toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">% Cambio:</span>
                    <span className={`font-mono ${Number(data.changePercentage) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {Number.isFinite(Number(data.changePercentage)) ? formatPercentage(Number(data.changePercentage)) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Beta:</span>
                    <span className="text-green-400 font-mono">
                      {typeof data.beta === 'number' ? data.beta.toFixed(3) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-gray-300 font-medium border-b border-gray-600 pb-2">Volumen y Dividendos</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Último Dividendo:</span>
                    <span className="text-green-400 font-mono">
                      {Number.isFinite(Number(data.lastDividend)) ? `$${Number(data.lastDividend).toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Volumen:</span>
                    <span className="text-green-400 font-mono">
                      {Number.isFinite(Number(data.volume)) ? Number(data.volume).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Vol. Promedio:</span>
                    <span className="text-green-400 font-mono">
                      {Number.isFinite(Number(data.averageVolume)) ? Number(data.averageVolume).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Rango 52 sem:</span>
                    <span className="text-green-400 font-mono text-xs">
                      {data.range || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
            <h3 className="text-green-400 text-lg font-semibold mb-3">Descripción del Negocio</h3>
            <p className="text-gray-200 text-sm leading-relaxed">
              {data.description || 'No hay descripción disponible para esta empresa.'}
            </p>
          </div>

          {/* Info adicional */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
            <h3 className="text-green-400 text-lg font-semibold mb-4">Información Adicional</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-gray-400">CIK:</span><span className="text-green-400 font-mono">{data.cik || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">ISIN:</span><span className="text-green-400 font-mono">{data.isin || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">CUSIP:</span><span className="text-green-400 font-mono">{data.cusip || 'N/A'}</span></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-gray-400">Teléfono:</span><span className="text-green-400">{data.phone || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Es ETF:</span><span className="text-green-400">{data.isEtf ? 'Sí' : 'No'}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Activamente negociado:</span><span className="text-green-400">{data.isActivelyTrading ? 'Sí' : 'No'}</span></div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
