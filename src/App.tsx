import React, { useState, useEffect, useRef } from 'react';
import { Upload, Filter, Trash2, Save, UserPlus, X, Check, FileUp, LineChart, ArrowUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

interface DeliveryData {
  data: string;
  motorista: string;
  rota: string;
  totalPedido: string;
  entregues: string;
  pendentes: string;
  insucessos: string;
  percentualEntregas: string;
  percentualRotas: string;
  regiao: string;
}

interface RegionStats {
  totalPedidos: number;
  entregues: number;
  insucessos: number;
  percentualEntregas: string;
}

type SortConfig = {
  key: keyof DeliveryData | null;
  direction: 'asc' | 'desc';
};

function App() {
  const [deliveries, setDeliveries] = useState<DeliveryData[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [batchRoute, setBatchRoute] = useState('');
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [showUploadArea, setShowUploadArea] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const tableRef = useRef<HTMLDivElement>(null);
  const [newDriver, setNewDriver] = useState<DeliveryData>({
    data: new Date().toLocaleDateString('pt-BR'),
    motorista: '',
    rota: '',
    totalPedido: '0',
    entregues: '',
    pendentes: '0',
    insucessos: '',
    percentualEntregas: '0%',
    percentualRotas: '0%',
    regiao: 'SP'
  });

  useEffect(() => {
    const savedData = localStorage.getItem('deliveryData');
    const savedTime = localStorage.getItem('deliveryDataTime');
    
    if (savedData && savedTime) {
      const now = new Date().getTime();
      const savedTimeMs = parseInt(savedTime);
      
      if (now - savedTimeMs < 24 * 60 * 60 * 1000) {
        setDeliveries(JSON.parse(savedData));
        setShowUploadArea(false);
      } else {
        localStorage.removeItem('deliveryData');
        localStorage.removeItem('deliveryDataTime');
      }
    }
  }, []);

  useEffect(() => {
    if (deliveries.length > 0) {
      localStorage.setItem('deliveryData', JSON.stringify(deliveries));
      localStorage.setItem('deliveryDataTime', new Date().getTime().toString());
    }
  }, [deliveries]);

  const calculateRegionStats = (region: string): RegionStats => {
    const regionDeliveries = region === 'TODOS' 
      ? deliveries 
      : deliveries.filter(d => d.regiao === region);
    
    const totalPedidos = regionDeliveries.reduce((sum, d) => sum + (parseInt(d.totalPedido) || 0), 0);
    const entregues = regionDeliveries.reduce((sum, d) => sum + (parseInt(d.entregues) || 0), 0);
    const insucessos = regionDeliveries.reduce((sum, d) => sum + (parseInt(d.insucessos) || 0), 0);
    const percentualEntregas = totalPedidos ? ((entregues / totalPedidos) * 100).toFixed(1) + '%' : '0%';

    return {
      totalPedidos,
      entregues,
      insucessos,
      percentualEntregas
    };
  };

  const getCurrentDate = () => {
    const today = new Date();
    return today.toLocaleDateString('pt-BR');
  };

  const calculatePercentage = (entregues: string, total: string): string => {
    if (!entregues || !total) return '0%';
    const delivered = parseInt(entregues) || 0;
    const totalNum = parseInt(total) || 0;
    if (totalNum === 0) return '0%';
    return `${((delivered / totalNum) * 100).toFixed(1)}%`;
  };

  const calculateRotaPercentage = (entregues: string, insucessos: string, total: string): string => {
    if (!total) return '0%';
    const entreguesNum = parseInt(entregues) || 0;
    const insucessosNum = parseInt(insucessos) || 0;
    const totalNum = parseInt(total) || 0;
    if (totalNum === 0) return '0%';
    return `${(((entreguesNum + insucessosNum) / totalNum) * 100).toFixed(1)}%`;
  };

  const calculatePendentes = (total: string, entregues: string, insucessos: string): string => {
    const totalNum = parseInt(total) || 0;
    const entreguesNum = parseInt(entregues) || 0;
    const insucessosNum = parseInt(insucessos) || 0;
    return Math.max(0, totalNum - entreguesNum - insucessosNum).toString();
  };

  const getPercentageColor = (percentage: string, isRota: boolean = false): { color: string; background: string } => {
    const value = parseFloat(percentage);
    
    if (isRota) {
      if (value === 100) return { color: 'text-green-600', background: 'bg-green-100' };
      if (value >= 96) return { color: 'text-yellow-600', background: 'bg-yellow-100' };
      return { color: 'text-red-600', background: 'bg-red-100' };
    } else {
      if (value >= 98) return { color: 'text-green-600', background: 'bg-green-100' };
      if (value >= 91) return { color: 'text-yellow-600', background: 'bg-yellow-100' };
      return { color: 'text-red-600', background: 'bg-red-100' };
    }
  };

  const extractNumberFromServices = (text: string): string => {
    const match = text.match(/Serviços:\s*(\d+)/);
    return match ? match[1] : '0';
  };

  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A' });
        const currentDate = getCurrentDate();
        
        const processedData: DeliveryData[] = [];
        let currentDelivery: Partial<DeliveryData> = {};

        jsonData.forEach((row: any) => {
          const cellA = row['A']?.toString() || '';

          if (cellA.startsWith('Agente:')) {
            if (currentDelivery.motorista) {
              processedData.push({
                data: currentDate,
                motorista: currentDelivery.motorista || '',
                rota: '',
                totalPedido: currentDelivery.totalPedido || '0',
                entregues: '',
                pendentes: currentDelivery.totalPedido || '0',
                insucessos: '',
                percentualEntregas: '0%',
                percentualRotas: '0%',
                regiao: currentDelivery.regiao || ''
              });
            }
            currentDelivery = {
              motorista: cellA.replace('Agente:', '').trim(),
              totalPedido: '0'
            };
          } else if (cellA.startsWith('Veículo:')) {
            const veiculo = cellA.replace('Veículo:', '').trim();
            currentDelivery.regiao = veiculo.includes('RJ') ? 'RJ' : 'SP';
          } else if (cellA.includes('Serviços:')) {
            currentDelivery.totalPedido = extractNumberFromServices(cellA);
          }
        });

        if (currentDelivery.motorista) {
          processedData.push({
            data: currentDate,
            motorista: currentDelivery.motorista || '',
            rota: '',
            totalPedido: currentDelivery.totalPedido || '0',
            entregues: '',
            pendentes: currentDelivery.totalPedido || '0',
            insucessos: '',
            percentualEntregas: '0%',
            percentualRotas: '0%',
            regiao: currentDelivery.regiao || ''
          });
        }

        setDeliveries(processedData);
        setShowUploadArea(false);
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        alert('Erro ao processar o arquivo. Verifique se é um arquivo XLSX válido.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const clearData = () => {
    setDeliveries([]);
    setFilter('');
    setBatchRoute('');
    setSelectedRows([]);
    setSelectAll(false);
    setShowUploadArea(true);
    localStorage.removeItem('deliveryData');
    localStorage.removeItem('deliveryDataTime');
  };

  const handleInputChange = (index: number, field: keyof DeliveryData, value: string) => {
    const updatedDeliveries = [...deliveries];
    updatedDeliveries[index] = {
      ...updatedDeliveries[index],
      [field]: value
    };

    if (field === 'entregues' || field === 'insucessos') {
      const delivery = updatedDeliveries[index];
      delivery.percentualEntregas = calculatePercentage(delivery.entregues, delivery.totalPedido);
      delivery.percentualRotas = calculateRotaPercentage(delivery.entregues, delivery.insucessos, delivery.totalPedido);
      delivery.pendentes = calculatePendentes(
        delivery.totalPedido,
        delivery.entregues,
        delivery.insucessos
      );
    }

    setDeliveries(updatedDeliveries);
  };

  const handleNewDriverChange = (field: keyof DeliveryData, value: string) => {
    setNewDriver(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'entregues' || field === 'insucessos') {
        updated.percentualEntregas = calculatePercentage(updated.entregues, updated.totalPedido);
        updated.percentualRotas = calculateRotaPercentage(updated.entregues, updated.insucessos, updated.totalPedido);
        updated.pendentes = calculatePendentes(updated.totalPedido, updated.entregues, updated.insucessos);
      }
      return updated;
    });
  };

  const addNewDriver = () => {
    if (newDriver.motorista && newDriver.regiao) {
      setDeliveries(prev => [...prev, { ...newDriver }]);
      setIsAddingDriver(false);
      setNewDriver({
        data: new Date().toLocaleDateString('pt-BR'),
        motorista: '',
        rota: '',
        totalPedido: '0',
        entregues: '',
        pendentes: '0',
        insucessos: '',
        percentualEntregas: '0%',
        percentualRotas: '0%',
        regiao: 'SP'
      });
    }
  };

  const applyBatchRoute = () => {
    if (!batchRoute) return;
    
    const updatedDeliveries = deliveries.map((delivery, index) => {
      if (selectedRows.includes(index)) {
        return {
          ...delivery,
          rota: batchRoute
        };
      }
      return delivery;
    });

    setDeliveries(updatedDeliveries);
    setSelectedRows([]);
    setBatchRoute('');
    setSelectAll(false);
  };

  const toggleRowSelection = (index: number) => {
    setSelectedRows(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredDeliveries.map((_, index) => index));
    }
    setSelectAll(!selectAll);
  };

  const generateEvolution = async () => {
    if (tableRef.current) {
      try {
        const canvas = await html2canvas(tableRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });
        const link = document.createElement('a');
        link.download = `evolucao-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      } catch (error) {
        console.error('Erro ao gerar evolução:', error);
        alert('Erro ao gerar a evolução. Por favor, tente novamente.');
      }
    }
  };

  const handleSort = (key: keyof DeliveryData) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedDeliveries = (deliveriesToSort: DeliveryData[]) => {
    if (!sortConfig.key) return deliveriesToSort;

    return [...deliveriesToSort].sort((a, b) => {
      let aValue = a[sortConfig.key!];
      let bValue = b[sortConfig.key!];

      // Handle percentage values
      if (aValue.endsWith('%')) {
        aValue = aValue.replace('%', '');
        bValue = bValue.replace('%', '');
      }

      // Handle numeric values
      if (!isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
        return sortConfig.direction === 'asc'
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }

      // Handle string values
      return sortConfig.direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });
  };

  const filteredDeliveries = getSortedDeliveries(
    deliveries.filter(delivery => {
      if (!filter || filter === 'TODOS') return true;
      return delivery.regiao === filter;
    })
  );

  const spStats = calculateRegionStats('SP');
  const rjStats = calculateRegionStats('RJ');
  const allStats = calculateRegionStats('TODOS');

  const renderSortIcon = (key: keyof DeliveryData) => {
    return (
      <ArrowUpDown
        className={`inline-block w-4 h-4 ml-1 ${
          sortConfig.key === key ? 'text-orange-300' : 'text-gray-300'
        }`}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Evolutivo de Rotas R2PP
            </h1>
            <p className="text-gray-600 mt-2">
              Importe, gerencie e acompanhe a evolução das entregas dos motoristas
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowUploadArea(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileUp className="w-4 h-4 mr-2" />
              Adicionar novo arquivo
            </button>
            <button
              onClick={() => setIsAddingDriver(true)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar Motorista
            </button>
            {deliveries.length > 0 && (
              <button
                onClick={clearData}
                className="flex items-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar dados
              </button>
            )}
          </div>
        </div>

        {showUploadArea && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <div 
              className="relative border-2 border-dashed rounded-xl transition-all duration-200 h-48"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                <div className="flex flex-col items-center justify-center p-6">
                  <Upload className={`w-8 h-8 mb-2 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                  <p className="text-sm text-gray-700 font-medium">
                    <span className="text-blue-600">Clique para fazer upload</span> ou arraste e solte
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        )}

        {deliveries.length > 0 && (
          <>
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center mb-4">
                    <Filter className="w-5 h-5 text-gray-600 mr-2" />
                    <h2 className="text-lg font-semibold text-gray-800">Filtrar por Região</h2>
                  </div>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Escolha a Região</option>
                    <option value="TODOS">Todas as Regiões</option>
                    <option value="SP">São Paulo</option>
                    <option value="RJ">Rio de Janeiro</option>
                  </select>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Aplicar Rota em Lote</h2>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={batchRoute}
                      onChange={(e) => setBatchRoute(e.target.value)}
                      placeholder="Número da Rota"
                      className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={applyBatchRoute}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      disabled={!batchRoute || selectedRows.length === 0}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {(filter === 'TODOS' || filter) && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {filter === 'TODOS' ? 'Todas as Regiões' : filter === 'SP' ? 'São Paulo' : 'Rio de Janeiro'}
                  </h3>
                  <button
                    onClick={generateEvolution}
                    className="flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    <LineChart className="w-4 h-4 mr-2" />
                    Gerar Evolução
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total de Pedidos</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {filter === 'TODOS' ? allStats.totalPedidos : filter === 'SP' ? spStats.totalPedidos : rjStats.totalPedidos}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Entregues</p>
                    <p className="text-2xl font-bold text-green-600">
                      {filter === 'TODOS' ? allStats.entregues : filter === 'SP' ? spStats.entregues : rjStats.entregues}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Insucessos</p>
                    <p className="text-2xl font-bold text-red-600">
                      {filter === 'TODOS' ? allStats.insucessos : filter === 'SP' ? spStats.insucessos : rjStats.insucessos}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">% Entregas</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {filter === 'TODOS' ? allStats.percentualEntregas : filter === 'SP' ? spStats.percentualEntregas : rjStats.percentualEntregas}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg overflow-x-auto" ref={tableRef}>
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-orange-600 transition-colors"
                      onClick={() => handleSort('data')}
                    >
                      Data {renderSortIcon('data')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-orange-600 transition-colors"
                      onClick={() => handleSort('motorista')}
                    >
                      Motorista {renderSortIcon('motorista')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-orange-600 transition-colors"
                      onClick={() => handleSort('percentualEntregas')}
                    >
                      % Entregas {renderSortIcon('percentualEntregas')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-orange-600 transition-colors"
                      onClick={() => handleSort('rota')}
                    >
                      Rota {renderSortIcon('rota')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-orange-600 transition-colors"
                      onClick={() => handleSort('totalPedido')}
                    >
                      Total Pedido {renderSortIcon('totalPedido')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-orange-600 transition-colors"
                      onClick={() => handleSort('entregues')}
                    >
                      Entregues {renderSortIcon('entregues')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-orange-600 transition-colors"
                      onClick={() => handleSort('pendentes')}
                    >
                      Pendentes {renderSortIcon('pendentes')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-orange-600 transition-colors"
                      onClick={() => handleSort('insucessos')}
                    >
                      Insucessos {renderSortIcon('insucessos')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-orange-600 transition-colors"
                      onClick={() => handleSort('percentualRotas')}
                    >
                      % Rota {renderSortIcon('percentualRotas')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-orange-600 transition-colors"
                      onClick={() => handleSort('regiao')}
                    >
                      Região {renderSortIcon('regiao')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.map((delivery, index) => {
                    const percentageColors = getPercentageColor(delivery.percentualEntregas);
                    const rotaPercentageColors = getPercentageColor(delivery.percentualRotas, true);
                    return (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(index)}
                            onChange={() => toggleRowSelection(index)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">{delivery.data}</td>
                        <td className="px-4 py-3">{delivery.motorista}</td>
                        <td className={`px-4 py-3 mx-2 ${percentageColors.color} ${percentageColors.background} rounded-lg text-center`}>
                          {delivery.percentualEntregas}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={delivery.rota}
                            onChange={(e) => handleInputChange(index, 'rota', e.target.value)}
                            className="w-20 p-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">{delivery.totalPedido}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={delivery.entregues}
                            onChange={(e) => handleInputChange(index, 'entregues', e.target.value)}
                            className="w-20 p-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">{delivery.pendentes}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={delivery.insucessos}
                            onChange={(e) => handleInputChange(index, 'insucessos', e.target.value)}
                            className="w-20 p-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                        <td className={`px-4 py-3 mx-2 ${rotaPercentageColors.color} ${rotaPercentageColors.background} rounded-lg text-center`}>
                          {delivery.percentualRotas}
                        </td>
                        <td className="px-4 py-3">{delivery.regiao}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {isAddingDriver && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Adicionar Motorista</h2>
                <button
                  onClick={() => setIsAddingDriver(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motorista
                  </label>
                  <input
                    type="text"
                    value={newDriver.motorista}
                    onChange={(e) => handleNewDriverChange('motorista', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Região
                  </label>
                  <select
                    value={newDriver.regiao}
                    onChange={(e) => handleNewDriverChange('regiao', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="SP">São Paulo</option>
                    <option value="RJ">Rio de Janeiro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rota
                  </label>
                  <input
                    type="number"
                    value={newDriver.rota}
                    onChange={(e) => handleNewDriverChange('rota', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total de Pedidos
                  </label>
                  <input
                    type="number"
                    value={newDriver.totalPedido}
                    onChange={(e) => handleNewDriverChange('totalPedido', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setIsAddingDriver(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={addNewDriver}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={!newDriver.motorista || !newDriver.regiao}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;