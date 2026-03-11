// Port of emu.cpp to TypeScript

export interface EmulatorState {
    A: number;
    B: number;
    PC: number;
    SP: number;
    memory: number[];
    instructionCount: number;
    status: 'running' | 'halted' | 'error';
    log: string;
}

export class SimplexEmulator {
    private memorySize: number;
    private memory: Int32Array; // Using Int32Array for proper 32-bit signed behavior

    public A = 0;
    public B = 0;
    public PC = 0;
    public SP = 0;
    public instructionCount = 0;

    public status: 'running' | 'halted' | 'error' = 'running';
    public log: string = '';

    // For the reverse execution 'Step Back' feature
    private history: { state: EmulatorState, memChanges: { addr: number, val: number }[] }[] = [];

    constructor(memSize = 65536) {
        this.memorySize = memSize;
        this.memory = new Int32Array(memSize);
    }

    public loadProgram(machineCode: number[]) {
        this.reset();
        for (let i = 0; i < machineCode.length; i++) {
            // Convert the unsigned 32-bit number back to a signed Int32 for the memory array
            this.memory[i] = machineCode[i] | 0;
        }
    }

    public reset() {
        this.A = 0;
        this.B = 0;
        this.PC = 0;
        this.SP = 0;
        this.instructionCount = 0;
        this.memory.fill(0);
        this.status = 'running';
        this.log = '';
        this.history = [];
    }

    public getState(): EmulatorState {
        return {
            A: this.A,
            B: this.B,
            PC: this.PC,
            SP: this.SP,
            memory: Array.from(this.memory.slice(0, 128)), // Return only first 128 words for performance in UI
            instructionCount: this.instructionCount,
            status: this.status,
            log: this.log
        };
    }

    public getMemoryAt(address: number, count: number = 16): number[] {
        if (address < 0 || address >= this.memorySize) return [];
        const end = Math.min(address + count, this.memorySize);
        return Array.from(this.memory.slice(address, end));
    }

    public step() {
        if (this.status !== 'running') return;

        if (this.PC < 0 || this.PC >= this.memorySize) {
            this.status = 'error';
            this.log += `\nSegmentation Fault: PC went out of bounds at ${this.PC}\n`;
            return;
        }

        // Save state for undo
        this.saveStateToHistory();

        const instruction = this.memory[this.PC];
        this.PC++;

        const opcode = instruction & 0xFF;
        let operand = instruction >> 8;
        // Sign extension is handled natively by JS >> operator on 32-bit ints, but we can enforce it:
        if (operand & 0x00800000) operand |= 0xFF000000;

        this.instructionCount++;

        this.executeOpcode(opcode, operand);
    }

    // Used for "Run" button
    public run(maxSteps: number = 100000) {
        let steps = 0;
        while (this.status === 'running' && steps < maxSteps) {
            this.step();
            steps++;
        }
        if (steps >= maxSteps) {
            this.status = 'error';
            this.log += `\nExecution halted: Exceeded maximum steps (${maxSteps}). Possible infinite loop.\n`;
        }
    }

    public stepBack() {
        if (this.history.length === 0) return;

        const lastState = this.history.pop()!;
        this.A = lastState.state.A;
        this.B = lastState.state.B;
        this.PC = lastState.state.PC;
        this.SP = lastState.state.SP;
        this.instructionCount = lastState.state.instructionCount;
        this.status = lastState.state.status;
        this.log = lastState.state.log;

        // Restore memory changes
        for (const change of lastState.memChanges) {
            this.memory[change.addr] = change.val;
        }
    }

    private executeOpcode(opcode: number, operand: number) {
        try {
            switch (opcode) {
                case 0: this.B = this.A; this.A = operand; break; // ldc
                case 1: this.A = (this.A + operand) | 0; break; // adc
                case 2:  // ldl
                    this.B = this.A;
                    this.A = this.readMem(this.SP + operand);
                    break;
                case 3:  // stl
                    this.writeMem(this.SP + operand, this.A);
                    this.A = this.B;
                    break;
                case 4: this.A = this.readMem(this.A + operand); break; // ldnl
                case 5: this.writeMem(this.A + operand, this.B); break; // stnl
                case 6: this.A = (this.B + this.A) | 0; break; // add
                case 7: this.A = (this.B - this.A) | 0; break; // sub
                case 8: this.A = (this.B << this.A) | 0; break; // shl
                case 9: this.A = (this.B >> this.A) | 0; break; // shr
                case 10: this.SP = (this.SP + operand) | 0; break; // adj
                case 11: this.SP = this.A; this.A = this.B; break; // a2sp
                case 12: this.B = this.A; this.A = this.SP; break; // sp2a
                case 13: this.B = this.A; this.A = this.PC; this.PC = (this.PC + operand) | 0; break; // call
                case 14: this.PC = this.A; this.A = this.B; break; // return
                case 15: if (this.A === 0) this.PC = (this.PC + operand) | 0; break; // brz
                case 16: if (this.A < 0) this.PC = (this.PC + operand) | 0; break; // brlz
                case 17: this.PC = (this.PC + operand) | 0; break; // br
                case 18: this.status = 'halted'; break; // HALT
                default:
                    this.log += `\nIllegal Instruction: Opcode ${opcode} at PC ${this.PC - 1}\n`;
                    this.status = 'error';
            }
        } catch (e) {
            this.status = 'error';
            this.log += `\nExecution Error: ${(e as Error).message}\n`;
        }
    }

    private readMem(addr: number): number {
        if (addr < 0 || addr >= this.memorySize) throw new Error(`Memory read out of bounds at ${addr}`);
        return this.memory[addr];
    }

    private currentMemChanges: { addr: number, val: number }[] = [];

    private writeMem(addr: number, val: number) {
        if (addr < 0 || addr >= this.memorySize) throw new Error(`Memory write out of bounds at ${addr}`);
        // Track change for history
        this.currentMemChanges.push({ addr, val: this.memory[addr] }); // store OLD value
        this.memory[addr] = val;
    }

    private saveStateToHistory() {
        this.currentMemChanges = [];
        this.history.push({
            state: {
                A: this.A,
                B: this.B,
                PC: this.PC,
                SP: this.SP,
                memory: [], // Don't copy memory array, use diffs instead
                instructionCount: this.instructionCount,
                status: this.status,
                log: this.log
            },
            memChanges: this.currentMemChanges
        });

        // Limit history to 100k steps to avoid memory leaks
        if (this.history.length > 100000) {
            this.history.shift();
        }
    }
}
