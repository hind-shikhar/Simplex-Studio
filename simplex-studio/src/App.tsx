import { useState } from 'react';
import { Play, StepForward, RotateCcw, SkipBack, Binary, Code2, Terminal } from 'lucide-react';
import { assemble } from './core/assembler';
import type { AssemblerResult } from './core/assembler';
import { SimplexEmulator } from './core/emulator';
import type { EmulatorState } from './core/emulator';

function App() {
  const [code, setCode] = useState<string>(`; bubblesort.asm example
count: SET 10
start: SET 0x100
    ldc start
    a2sp
    ldc count
loop:
    ldc 0
    brz loop
HALT`);

  const [assemblerResult, setAssemblerResult] = useState<AssemblerResult | null>(null);
  const [emu] = useState(() => new SimplexEmulator());
  const [emuState, setEmuState] = useState<EmulatorState>(emu.getState());
  const [activeTab, setActiveTab] = useState<'editor' | 'listing'>('editor');

  const updateState = () => setEmuState(emu.getState());

  const handleAssemble = () => {
    const result = assemble(code);
    setAssemblerResult(result);
    if (result.success) {
      emu.loadProgram(result.machineCode);
      updateState();
    }
  };

  const handleRun = () => {
    if (!assemblerResult?.success) return;
    emu.run();
    updateState();
  };

  const handleStep = () => {
    if (!assemblerResult?.success) return;
    emu.step();
    updateState();
  };

  const handleStepBack = () => {
    emu.stepBack();
    updateState();
  };

  const handleReset = () => {
    emu.reset();
    if (assemblerResult?.success) {
      emu.loadProgram(assemblerResult.machineCode);
    }
    updateState();
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-100 flex flex-col font-sans">
      <header className="h-16 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded overflow-hidden shadow-lg shadow-blue-500/20 bg-black flex items-center justify-center border border-[#27272a]">
            <img src="/logo.png" alt="Simplex Studio Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Simplex Studio</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAssemble}
            className="px-4 py-2 rounded-md bg-[#27272a] hover:bg-[#3f3f46] text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Code2 size={16} />
            Assemble
          </button>

          <div className="w-px h-6 bg-[#27272a] mx-2"></div>

          <button
            onClick={handleReset}
            disabled={!assemblerResult?.success}
            className="p-2 rounded-md bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 disabled:opacity-50 transition-colors"
            title="Reset"
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={handleStepBack}
            disabled={!assemblerResult?.success || emuState.instructionCount === 0}
            className="p-2 rounded-md bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 disabled:opacity-50 transition-colors"
            title="Step Back"
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={handleStep}
            disabled={!assemblerResult?.success || emuState.status !== 'running'}
            className="p-2 rounded-md bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 disabled:opacity-50 transition-colors"
            title="Step Forward"
          >
            <StepForward size={16} />
          </button>

          <button
            onClick={handleRun}
            disabled={!assemblerResult?.success || emuState.status !== 'running'}
            className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Play size={16} />
            Run
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 flex flex-col border-r border-[#27272a]">
          <div className="flex border-b border-[#27272a] bg-[#18181b]">
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'editor' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              onClick={() => setActiveTab('editor')}
            >
              source.asm
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'listing' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
              onClick={() => setActiveTab('listing')}
            >
              listing.lst
            </button>
          </div>

          <div className="flex-1 bg-[#18181b] relative overflow-hidden">
            {activeTab === 'editor' ? (
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="w-full h-full bg-transparent text-gray-300 font-mono p-4 outline-none resize-none leading-relaxed"
                style={{ tabSize: 4 }}
              />
            ) : (
              <pre className="w-full h-full overflow-auto bg-[#18181b] text-gray-300 font-mono p-4 text-sm leading-relaxed">
                {assemblerResult?.listing?.join('\n') || 'No listing available. Assemble code first.'}
              </pre>
            )}
          </div>

          <div className="h-48 border-t border-[#27272a] bg-[#09090b] flex flex-col shrink-0">
            <div className="px-4 py-1.5 border-b border-[#27272a] flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider bg-[#18181b]">
              <Terminal size={12} />
              Terminal Output
            </div>
            <div className="flex-1 p-3 overflow-auto font-mono text-sm">
              {!assemblerResult ? (
                <span className="text-gray-500">Ready...</span>
              ) : (
                <div className="space-y-1">
                  {assemblerResult.logs.map((log, i) => (
                    <div key={i} className={log.includes('Error') ? 'text-red-400' : 'text-green-400'}>
                      {log}
                    </div>
                  ))}
                  {emuState.log && (
                    <div className="text-yellow-400 whitespace-pre-wrap mt-2 pt-2 border-t border-[#27272a]">
                      {emuState.log}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-1/2 flex flex-col bg-[#09090b]">
          <div className="p-4 border-b border-[#27272a]">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Registers</h2>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'A', value: emuState.A },
                { label: 'B', value: emuState.B },
                { label: 'PC', value: emuState.PC, highlight: true },
                { label: 'SP', value: emuState.SP }
              ].map(reg => (
                <div key={reg.label} className="bg-[#18181b] rounded-lg border border-[#27272a] p-3 flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1 font-medium">{reg.label}</span>
                  <span className={`font-mono text-lg ${reg.highlight ? 'text-blue-400' : 'text-gray-200'}`}>
                    {reg.value.toString(16).padStart(8, '0').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3 flex justify-between items-center border-b border-[#27272a] bg-[#18181b]">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Status:</span>
              <span className={`font-medium ${emuState.status === 'running' ? 'text-green-400' : emuState.status === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                {emuState.status.toUpperCase()}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Instructions Executed: <span className="font-mono text-gray-200">{emuState.instructionCount}</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-[#27272a] flex items-center justify-between bg-[#18181b]">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-400 uppercase tracking-wider">
                <Binary size={14} />
                Memory View (0x0000 - 0x0080)
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed">
              {Array.from({ length: emuState.memory.length / 4 }).map((_, rowIndex) => {
                const addr = rowIndex * 4;
                return (
                  <div key={addr} className="flex hover:bg-[#18181b] px-2 py-0.5 rounded transition-colors group">
                    <span className="text-gray-500 w-20 select-none">{addr.toString(16).padStart(8, '0').toUpperCase()}:</span>
                    <div className="flex gap-4">
                      {[0, 1, 2, 3].map(offset => {
                        const val = emuState.memory[addr + offset];
                        return (
                          <span key={offset} className={`w-20 ${val !== 0 ? 'text-blue-300' : 'text-gray-600'}`}>
                            {val.toString(16).padStart(8, '0').toUpperCase()}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
