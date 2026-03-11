// Port of asm1.cpp to TypeScript

export interface Instruction {
  opcode: number;
  requires_operand: boolean;
}

export const opcodes: Record<string, Instruction> = {
  "ldc": { opcode: 0, requires_operand: true },
  "adc": { opcode: 1, requires_operand: true },
  "ldl": { opcode: 2, requires_operand: true },
  "stl": { opcode: 3, requires_operand: true },
  "ldnl": { opcode: 4, requires_operand: true },
  "stnl": { opcode: 5, requires_operand: true },
  "add": { opcode: 6, requires_operand: false },
  "sub": { opcode: 7, requires_operand: false },
  "shl": { opcode: 8, requires_operand: false },
  "shr": { opcode: 9, requires_operand: false },
  "adj": { opcode: 10, requires_operand: true },
  "a2sp": { opcode: 11, requires_operand: false },
  "sp2a": { opcode: 12, requires_operand: false },
  "call": { opcode: 13, requires_operand: true },
  "return": { opcode: 14, requires_operand: false },
  "brz": { opcode: 15, requires_operand: true },
  "brlz": { opcode: 16, requires_operand: true },
  "br": { opcode: 17, requires_operand: true },
  "HALT": { opcode: 18, requires_operand: false }
};

export interface AssemblerResult {
  success: boolean;
  machineCode: number[];
  logs: string[];
  listing: string[];
  symbolTable: Record<string, number>;
}

function cleanLine(line: string): string {
  const commentPos = line.indexOf(';');
  let cleaned = commentPos !== -1 ? line.substring(0, commentPos) : line;
  return cleaned.trim();
}

export function assemble(code: string): AssemblerResult {
  const lines = code.split('\n').map(cleanLine);
  const symbolTable: Record<string, number> = {};
  const logs: string[] = [];
  const listing: string[] = [];
  const machineCode: number[] = [];

  // Pass 1
  let pc = 0;
  for (let i = 0; i < lines.length; i++) {
    let currentLine = lines[i];
    if (currentLine.length === 0) continue;

    const colonPos = currentLine.indexOf(':');
    let label = "";

    if (colonPos !== -1) {
      label = currentLine.substring(0, colonPos).trim();
      
      if (label in symbolTable) {
        logs.push(`Error at line ${i + 1}: Duplicate label definition '${label}'`);
        return { success: false, machineCode: [], logs, listing: [], symbolTable: {} };
      }
      currentLine = currentLine.substring(colonPos + 1).trim();
    }

    if (currentLine.length > 0) {
      const parts = currentLine.split(/\s+/);
      const mnemonic = parts[0];

      if (mnemonic === "SET") {
        const valStr = parts[1];
        if (valStr !== undefined) {
          symbolTable[label] = valStr.startsWith('0x') ? parseInt(valStr, 16) : parseInt(valStr, 10);
        } else {
          logs.push(`Error at line ${i + 1}: SET missing operand`);
          return { success: false, machineCode: [], logs, listing: [], symbolTable: {} };
        }
      } else {
        if (label !== "") symbolTable[label] = pc;
        pc++;
      }
    } else if (label !== "") {
      symbolTable[label] = pc;
    }
  }

  // Pass 2
  pc = 0;
  for (let i = 0; i < lines.length; i++) {
    let currentLine = lines[i];
    if (currentLine.length === 0) continue;

    const colonPos = currentLine.indexOf(':');
    if (colonPos !== -1) {
      const label = currentLine.substring(0, colonPos).trim();
      listing.push(`${pc.toString(16).padStart(8, '0')}         ${label}:`);
      currentLine = currentLine.substring(colonPos + 1).trim();
    }

    if (currentLine.length === 0) continue;

    const parts = currentLine.split(/\s+/);
    const mnemonic = parts[0];
    const operandStr = parts[1];

    if (mnemonic === "SET") continue;

    let instrCode = 0;

    if (mnemonic === "data") {
      if (operandStr === undefined) {
        logs.push(`Error: 'data' missing operand at line ${i + 1}`);
        return { success: false, machineCode: [], logs, listing: [], symbolTable: {} };
      }
      instrCode = operandStr.startsWith('0x') ? parseInt(operandStr, 16) : parseInt(operandStr, 10);
      instrCode = instrCode | 0; // to 32 bit int
    } else if (mnemonic in opcodes) {
      const instr = opcodes[mnemonic];
      let operandVal = 0;

      if (instr.requires_operand) {
        if (operandStr === undefined) {
          logs.push(`Error: Missing operand for ${mnemonic} at line ${i + 1}`);
          return { success: false, machineCode: [], logs, listing: [], symbolTable: {} };
        }

        if (operandStr in symbolTable) {
          if (mnemonic === "br" || mnemonic === "brz" || mnemonic === "brlz" || mnemonic === "call") {
            operandVal = symbolTable[operandStr] - (pc + 1);
          } else {
            operandVal = symbolTable[operandStr];
          }
        } else {
          operandVal = operandStr.startsWith('0x') ? parseInt(operandStr, 16) : parseInt(operandStr, 10);
          if (isNaN(operandVal)) {
            logs.push(`Error: Invalid operand '${operandStr}' at line ${i + 1}`);
            return { success: false, machineCode: [], logs, listing: [], symbolTable: {} };
          }
        }
      } else {
        if (operandStr !== undefined && !operandStr.startsWith(';')) {
           logs.push(`Error: Unexpected operand for ${mnemonic} at line ${i + 1}`);
           return { success: false, machineCode: [], logs, listing: [], symbolTable: {} };
        }
      }

      // Convert to 32bit representation matching C++ logic: ((operand_val & 0xFFFFFF) << 8) | (instr.opcode & 0xFF)
      instrCode = (((operandVal & 0xFFFFFF) << 8) | (instr.opcode & 0xFF)) >>> 0;
    } else {
      logs.push(`Error: Unknown mnemonic '${mnemonic}' at line ${i + 1}`);
      return { success: false, machineCode: [], logs, listing: [], symbolTable: {} };
    }

    machineCode.push(instrCode);
    listing.push(`${pc.toString(16).padStart(8, '0')} ${instrCode.toString(16).padStart(8, '0').toUpperCase()} ${mnemonic} ${operandStr || ''}`);
    pc++;
  }

  logs.push("Assembly completed successfully.");
  return {
    success: true,
    machineCode,
    logs,
    listing,
    symbolTable
  };
}
