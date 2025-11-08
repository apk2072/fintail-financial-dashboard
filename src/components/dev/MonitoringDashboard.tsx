import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  ExclamationTriangleIcon,
  CpuChipIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { analytics } from '../../services/analytics';
import { errorLogger } from '../../services/errorLogging';
import { getMemoryUsage, getNetworkInfo } from '../../utils/performance';

interface MonitoringDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'errors' | 'performance'>('analytics');
  const [sessionData, setSessionData] = useState(analytics.getSessionData());
  const [errorLogs, setErrorLogs] = useState(errorLogger.getLogs());
  const [memoryUsage, setMemoryUsage] = useState(getMemoryUsage());
  const [networkInfo, setNetworkInfo] = useState(getNetworkInfo());

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setSessionData(analytics.getSessionData());
      setErrorLogs(errorLogger.getLogs());
      setMemoryUsage(getMemoryUsage());
      setNetworkInfo(getNetworkInfo());
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const renderAnalyticsTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900">Events Tracked</h4>
          <p className="text-2xl font-bold text-blue-700">{sessionData.events}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-medium text-green-900">Metrics Collected</h4>
          <p className="text-2xl font-bold text-green-700">{sessionData.metrics}</p>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Session Info</h4>
        <div className="text-sm space-y-1">
          <p><strong>Session ID:</strong> {sessionData.sessionId}</p>
          <p><strong>User ID:</strong> {sessionData.userId || 'Anonymous'}</p>
          <p><strong>Start Time:</strong> {sessionData.startTime}</p>
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => {
            const data = analytics.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-${Date.now()}.json`;
            a.click();
          }}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
        >
          Export Data
        </button>
      </div>
    </div>
  );

  const renderErrorsTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 p-4 rounded-lg">
          <h4 className="font-medium text-red-900">Errors</h4>
          <p className="text-2xl font-bold text-red-700">
            {errorLogs.filter(log => log.level === 'error').length}
          </p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="font-medium text-yellow-900">Warnings</h4>
          <p className="text-2xl font-bold text-yellow-700">
            {errorLogs.filter(log => log.level === 'warning').length}
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900">Info</h4>
          <p className="text-2xl font-bold text-blue-700">
            {errorLogs.filter(log => log.level === 'info').length}
          </p>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2">
        {errorLogs.slice(0, 10).map((log) => (
          <div
            key={log.id}
            className={`p-3 rounded-lg text-sm ${
              log.level === 'error' ? 'bg-red-50 border border-red-200' :
              log.level === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-blue-50 border border-blue-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium">{log.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                log.level === 'error' ? 'bg-red-100 text-red-800' :
                log.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {log.level}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => {
            const data = errorLogger.exportLogs();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `error-logs-${Date.now()}.json`;
            a.click();
          }}
          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
        >
          Export Logs
        </button>
        <button
          onClick={() => {
            errorLogger.clearLogs();
            setErrorLogs([]);
          }}
          className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
        >
          Clear Logs
        </button>
      </div>
    </div>
  );

  const renderPerformanceTab = () => (
    <div className="space-y-4">
      {memoryUsage && (
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="font-medium text-purple-900 mb-2">Memory Usage</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-purple-700">Used</p>
              <p className="font-bold">{memoryUsage.used} MB</p>
            </div>
            <div>
              <p className="text-purple-700">Total</p>
              <p className="font-bold">{memoryUsage.total} MB</p>
            </div>
            <div>
              <p className="text-purple-700">Limit</p>
              <p className="font-bold">{memoryUsage.limit} MB</p>
            </div>
          </div>
        </div>
      )}

      {networkInfo && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">Network Info</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-green-700">Connection</p>
              <p className="font-bold">{networkInfo.effectiveType}</p>
            </div>
            <div>
              <p className="text-green-700">Downlink</p>
              <p className="font-bold">{networkInfo.downlink} Mbps</p>
            </div>
            <div>
              <p className="text-green-700">RTT</p>
              <p className="font-bold">{networkInfo.rtt} ms</p>
            </div>
            <div>
              <p className="text-green-700">Save Data</p>
              <p className="font-bold">{networkInfo.saveData ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-orange-50 p-4 rounded-lg">
        <h4 className="font-medium text-orange-900 mb-2">Performance Tips</h4>
        <ul className="text-sm text-orange-800 space-y-1">
          <li>• Monitor memory usage to prevent leaks</li>
          <li>• Check network conditions for adaptive loading</li>
          <li>• Watch for layout shifts and long tasks</li>
          <li>• Optimize images and bundle sizes</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Development Monitoring</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center px-4 py-2 text-sm font-medium ${
              activeTab === 'analytics'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ChartBarIcon className="h-4 w-4 mr-2" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('errors')}
            className={`flex items-center px-4 py-2 text-sm font-medium ${
              activeTab === 'errors'
                ? 'border-b-2 border-red-500 text-red-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
            Errors ({errorLogs.filter(log => log.level === 'error').length})
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex items-center px-4 py-2 text-sm font-medium ${
              activeTab === 'performance'
                ? 'border-b-2 border-purple-500 text-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CpuChipIcon className="h-4 w-4 mr-2" />
            Performance
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-96">
          {activeTab === 'analytics' && renderAnalyticsTab()}
          {activeTab === 'errors' && renderErrorsTab()}
          {activeTab === 'performance' && renderPerformanceTab()}
        </div>
      </div>
    </div>
  );
};

// Development monitoring toggle
export const DevMonitoringToggle: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Only show in development
  if (!import.meta.env.DEV) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 z-40"
        title="Open Monitoring Dashboard"
      >
        <ChartBarIcon className="h-5 w-5" />
      </button>
      
      <MonitoringDashboard isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};