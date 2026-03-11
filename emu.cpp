#include <iostream>
#include <fstream>
#include <vector>
#include <iomanip>
#include <cstdint>
using namespace std;

class SimplexEmulator {
private:
    int32_t A = 0, B = 0, PC = 0, SP = 0;
    vector<int32_t> memory;
    int instruction_count = 0;

public:
    SimplexEmulator(size_t mem_size = 65536) : memory(mem_size, 0) {}

    bool loadProgram(const string& filename) {
        ifstream file(filename, ios::binary);
        if (!file.is_open()) return false;

        int32_t instruction;
        int i = 0;
        //reading the bytes form the obj file
        while (file.read(reinterpret_cast<char*>(&instruction), sizeof(instruction))) {
            memory[i++] = instruction;
        }
        return true;
    }

    void execute(ostream& log_out) {
        bool running = true;
        while (running) {
            if (PC < 0 || PC >= memory.size()) {
                log_out << "\nSegmentation Fault: PC went out of bounds at " << PC << endl;
                break;
            }

            int32_t instruction = memory[PC];
            PC++;
            int opcode = instruction & 0xFF;//lower 8 bits are taken
            int32_t operand = instruction >> 8;//getting the 24 bits
            if (operand & 0x00800000) operand |= 0xFF000000; // Sign extension
            instruction_count++;

            switch(opcode) {
                case 0:  B = A; A = operand; break;
                case 1:  A = A + operand; break;
                case 2:  B = A; A = memory[SP + operand]; break;
                case 3:  memory[SP + operand] = A; A = B; break;
                case 4:  A = memory[A + operand]; break;
                case 5:  memory[A + operand] = B; break;
                case 6:  A = B + A; break;
                case 7:  A = B - A; break;
                case 8:  A = B << A; break;
                case 9:  A = B >> A; break;
                case 10: SP = SP + operand; break;
                case 11: SP = A; A = B; break;
                case 12: B = A; A = SP; break;
                case 13: B = A; A = PC; PC = PC + operand; break;
                case 14: PC = A; A = B; break;
                case 15: if (A == 0) PC = PC + operand; break;
                case 16: if (A < 0) PC = PC + operand; break;
                case 17: PC = PC + operand; break;
                case 18: running = false; break;
                default:
                    log_out << "\nIllegal Instruction: Opcode " << opcode << " at PC " << PC - 1 << endl;
                    running = false;
            }
        }
        dumpState(log_out); // Pass log file directly to the dump function
    }

    // Prints state directly to the log file instead of the console
    void dumpState(ostream& log_out) {
        log_out << "\nEmulator Memory Dump" << endl;
        log_out << "Instructions Executed: " << dec << instruction_count << endl;
        log_out << "Registers:" << endl;
        log_out << "A:  " << hex << setw(8) <<  setfill('0') << A << endl;
        log_out << "B:  " << hex << setw(8) <<  setfill('0') << B << endl;
        log_out << "PC: " << hex << setw(8) <<  setfill('0') << PC << endl;
        log_out << "SP: " << hex << setw(8) <<  setfill('0') << SP << endl;
        
        log_out << "\nMemory Dump" << endl;
        for (int i = 0; i < memory.size(); i += 4) {
            log_out << hex << setw(8) << setfill('0') << i << ":  ";
            for (int j = 0; j < 4; j++) {
                log_out << setw(8) << setfill('0') << memory[i+j] << "  ";
            }
            log_out << endl;
        }
    }
};

int main(int argc, char* argv[]) {
    if (argc < 2) {
        cerr << "Usage: " << argv[0] << " <program.obj>" << std::endl;
        return 1;
    }

    string filename = argv[1];
    string base_name = filename.substr(0, filename.find_last_of('.'));
    
    // Open the same log file in append mode
    ofstream log_out(base_name + "_emu.log", ios::app);

    SimplexEmulator emu;
    if (emu.loadProgram(filename)) {
        cout << "Executing program check " << base_name << ".log for memory dump." << endl;
        emu.execute(log_out);
    } else {
        cerr << "Failed to load program." << endl;
        log_out << "Emulator failed to load " << filename << endl;
    }
    return 0;
}