import React, { useState, useEffect } from 'react';
import { Files, Folder, FileText, ChevronRight, Search, Plus, HardDrive } from 'lucide-react';
import { OSAppWindow } from '../hooks/useOS';

interface FileExplorerProps {
  windowData?: OSAppWindow;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ windowData }) => {
  const [files, setFiles] = useState([
    { id: '1', name: 'Documents', type: 'folder', size: '-' },
    { id: '2', name: 'Downloads', type: 'folder', size: '-' },
    { id: '3', name: 'system.config', type: 'file', size: '1.2 KB' },
    { id: '4', name: 'agent_logs.txt', type: 'file', size: '45 KB' },
  ]);

  useEffect(() => {
    if (windowData?.lastAction && windowData.lastAction.type === 'create_file') {
      const newFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: windowData.lastAction.payload,
        type: 'file',
        size: '0 KB'
      };
      setFiles(prev => [...prev, newFile]);
    }
  }, [windowData?.lastAction]);

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar */}
      <div className="w-48 border-r border-black/5 p-4 space-y-6">
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Favorites</h3>
          <div className="space-y-1">
            {['Recents', 'Desktop', 'Documents', 'Downloads'].map(item => (
              <button key={item} className="w-full text-left px-2 py-1.5 text-xs hover:bg-black/5 rounded-md transition-colors">
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Storage</h3>
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-600">
            <HardDrive size={14} />
            <span>NeuroDrive</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="h-12 border-b border-black/5 flex items-center justify-between px-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <ChevronRight size={16} />
            <span className="text-xs font-medium text-zinc-900">Home</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 hover:bg-black/5 rounded-md"><Search size={16} /></button>
            <button className="p-1.5 hover:bg-black/5 rounded-md"><Plus size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-black/5">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Size</th>
              </tr>
            </thead>
            <tbody>
              {files.map(file => (
                <tr key={file.id} className="text-xs hover:bg-zinc-50 cursor-default group">
                  <td className="px-6 py-3 flex items-center gap-3">
                    {file.type === 'folder' ? <Folder size={16} className="text-blue-500" /> : <FileText size={16} className="text-zinc-400" />}
                    <span className="font-medium">{file.name}</span>
                  </td>
                  <td className="px-6 py-3 text-zinc-500 capitalize">{file.type}</td>
                  <td className="px-6 py-3 text-zinc-500">{file.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
