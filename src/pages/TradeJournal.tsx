import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth, SERVER_URL } from '../context/AuthContext';
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Filter,
  RefreshCw,
  Trash2,
  Edit3,
  Check,
  AlertCircle,
} from 'lucide-react';

const INDEX_OPTIONS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];

interface Trade {
  id: string;
  index: string;
  strike_price: number;
  option_type: string;
  trade_type: string;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  status: string;
  pnl: number | null;
  entry_time: string;
  exit_time: string | null;
  notes: string;
  source: string;
}

const TradeJournal: React.FC = () => {
  const { getAccessToken } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [totalPnl, setTotalPnl] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterIndex, setFilterIndex] = useState('');

  // Add trade modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    index: 'NIFTY',
    strike_price: '',
    option_type: 'CE',
    trade_type: 'BUY',
    entry_price: '',
    quantity: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close trade modal
  const [closingTradeId, setClosingTradeId] = useState<string | null>(null);
  const [exitPrice, setExitPrice] = useState('');

  const getHeaders = useCallback(() => {
    const token = getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, [getAccessToken]);

  const fetchTrades = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (filterIndex) params.index = filterIndex;

      const response = await axios.get(`${SERVER_URL}/api/trades`, {
        headers: getHeaders(),
        params,
      });

      if (response.data.success) {
        setTrades(response.data.trades);
        setTotalPnl(response.data.total_pnl || 0);
        setOpenCount(response.data.open_count || 0);
        setTotalCount(response.data.total || 0);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch trades');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, filterStatus, filterIndex]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const response = await axios.post(
        `${SERVER_URL}/api/trades`,
        {
          index: formData.index,
          strike_price: parseFloat(formData.strike_price),
          option_type: formData.option_type,
          trade_type: formData.trade_type,
          entry_price: parseFloat(formData.entry_price),
          quantity: parseInt(formData.quantity),
          notes: formData.notes,
        },
        { headers: getHeaders() }
      );

      if (response.data.success) {
        setShowAddModal(false);
        setFormData({
          index: 'NIFTY',
          strike_price: '',
          option_type: 'CE',
          trade_type: 'BUY',
          entry_price: '',
          quantity: '',
          notes: '',
        });
        fetchTrades();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create trade');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseTrade = async (tradeId: string) => {
    if (!exitPrice) return;

    try {
      await axios.put(
        `${SERVER_URL}/api/trades/${tradeId}`,
        { exit_price: parseFloat(exitPrice) },
        { headers: getHeaders() }
      );
      setClosingTradeId(null);
      setExitPrice('');
      fetchTrades();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to close trade');
    }
  };

  const handleCancelTrade = async (tradeId: string) => {
    try {
      await axios.put(
        `${SERVER_URL}/api/trades/${tradeId}`,
        { status: 'CANCELLED' },
        { headers: getHeaders() }
      );
      fetchTrades();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel trade');
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!confirm('Are you sure you want to delete this trade?')) return;

    try {
      await axios.delete(`${SERVER_URL}/api/trades/${tradeId}`, {
        headers: getHeaders(),
      });
      fetchTrades();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete trade');
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const closedCount = trades.filter((t) => t.status === 'CLOSED').length;
  const winCount = trades.filter((t) => t.status === 'CLOSED' && (t.pnl || 0) > 0).length;
  const winRate = closedCount > 0 ? ((winCount / closedCount) * 100).toFixed(1) : '0.0';

  return (
    <div className="p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/80 backdrop-blur border border-gray-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total P&L</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  totalPnl >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toFixed(2)}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                totalPnl >= 0
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/80 backdrop-blur border border-gray-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Open Trades</p>
              <p className="text-2xl font-bold mt-1 text-blue-400">{openCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/80 backdrop-blur border border-gray-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Trades</p>
              <p className="text-2xl font-bold mt-1 text-purple-400">{totalCount}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <TrendingDown className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/80 backdrop-blur border border-gray-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Win Rate</p>
              <p className="text-2xl font-bold mt-1 text-yellow-400">{winRate}%</p>
            </div>
            <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-400">
              <Check className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={filterIndex}
            onChange={(e) => setFilterIndex(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Indices</option>
            {INDEX_OPTIONS.map((idx) => (
              <option key={idx} value={idx}>
                {idx}
              </option>
            ))}
          </select>
          <button
            onClick={fetchTrades}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-gray-300" />
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="h-5 w-5" />
          <span>Add Trade</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Trades Table */}
      <div className="bg-gray-800/80 backdrop-blur border border-gray-700/50 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-400">Loading trades...</span>
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-16">
            <TrendingUp className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No trades yet</p>
            <p className="text-gray-500 text-sm mt-1">Click "Add Trade" to log your first trade</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-900/50">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Time</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Index</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Strike</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Entry</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Exit</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">Qty</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium">P&L</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {formatDateTime(trade.entry_time)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-700 rounded text-xs font-semibold text-orange-400">
                        {trade.index}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-semibold">{trade.strike_price}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          trade.trade_type === 'BUY'
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {trade.trade_type} {trade.option_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">₹{trade.entry_price}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {closingTradeId === trade.id ? (
                        <div className="flex items-center justify-end space-x-1">
                          <input
                            type="number"
                            value={exitPrice}
                            onChange={(e) => setExitPrice(e.target.value)}
                            className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Price"
                            autoFocus
                            step="0.05"
                          />
                          <button
                            onClick={() => handleCloseTrade(trade.id)}
                            className="p-1 text-green-400 hover:text-green-300"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setClosingTradeId(null);
                              setExitPrice('');
                            }}
                            className="p-1 text-gray-400 hover:text-gray-300"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : trade.exit_price !== null ? (
                        `₹${trade.exit_price}`
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{trade.quantity}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        trade.pnl !== null
                          ? trade.pnl >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {trade.pnl !== null
                        ? `${trade.pnl >= 0 ? '+' : ''}₹${trade.pnl.toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          trade.status === 'OPEN'
                            ? 'bg-blue-500/15 text-blue-400'
                            : trade.status === 'CLOSED'
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-gray-500/15 text-gray-400'
                        }`}
                      >
                        {trade.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {trade.status === 'OPEN' && (
                          <>
                            <button
                              onClick={() => setClosingTradeId(trade.id)}
                              className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition-colors"
                              title="Close Trade"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleCancelTrade(trade.id)}
                              className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 rounded transition-colors"
                              title="Cancel Trade"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteTrade(trade.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                          title="Delete Trade"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Trade Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Log New Trade</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddTrade} className="space-y-4">
              {/* Index + Option Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Index</label>
                  <select
                    value={formData.index}
                    onChange={(e) => setFormData({ ...formData, index: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {INDEX_OPTIONS.map((idx) => (
                      <option key={idx} value={idx}>
                        {idx}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Option Type</label>
                  <div className="flex space-x-2">
                    {['CE', 'PE'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, option_type: type })}
                        className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                          formData.option_type === type
                            ? type === 'CE'
                              ? 'bg-blue-500 text-white'
                              : 'bg-orange-500 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trade Type */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Trade Type</label>
                <div className="flex space-x-2">
                  {['BUY', 'SELL'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, trade_type: type })}
                      className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        formData.trade_type === type
                          ? type === 'BUY'
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Strike + Entry + Qty */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Strike Price</label>
                  <input
                    type="number"
                    value={formData.strike_price}
                    onChange={(e) => setFormData({ ...formData, strike_price: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="24500"
                    required
                    step="50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Entry Price</label>
                  <input
                    type="number"
                    value={formData.entry_price}
                    onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="150.5"
                    required
                    step="0.05"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="50"
                    required
                    min="1"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                  placeholder="Why did you take this trade?"
                  maxLength={500}
                />
              </div>

              {/* Error */}
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <p className="text-red-400 text-sm text-center">{formError}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-xl transition-all shadow-lg"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    <span>Log Trade</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeJournal;
